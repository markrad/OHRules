'use strict';

const util = require('util');
const log4js = require('log4js');
const http = require('http');
// const moment = require('moment');
// const async = require('async');
const path = require('path');
const walk = require('walk');
const fs = require('fs');
const mqtt = require('mqtt');
const _ = require('underscore');
const mqttAppender = require('./log4js-mqtt-appender');
var ON_DEATH = require('death');

// Constants
const HOSTPATH = '/rest/items';
const ITEMTYPES = [ 'Group', 'Switch', 'Dimmer', 'DateTime', 'Number', 'Contact', 'String', 'Location' ];
const UTILITIESDIR = path.resolve(__dirname, './OHUtilities');

var ohClasses = {}

_.each(ITEMTYPES, function(element, index, list)
{
    ohClasses[element] = require('./OHItemClasses/OHItem' + element);
});

class OHRuleServer
{
    constructor(config)
    {
        module.exports.Config = config;
        this._config = config;
        this._mqttClient = null;
        this._items = {};
        this._modules = [];
        this._repeaters = [];
        this._repeaterHandle = 0;
        this._mqttServer = null;
        
        log4js.configure(
            {
                appenders: 
                {
                    out: 
                    { 
                        type: 'console' 
                    },
                    rolling: 
                    { 
                        type: 'dateFile', 
                        filename: this._config.rollingLogger.logFile || 'logs/ohrules_temp.log',    // There really is no good default...
                        pattern: '.yyyy-MM-dd', 
                        alwaysIncludePattern: true, 
                        daysToKeep: 7, 
                        keepFileExt: true 
                    },
                    mqtt: 
                    { 
                        type: mqttAppender, 
                        host: this._config.mqttLogger.host || 'mqtt://localhost:1883', 
                        auth: this._config.mqttLogger.auth || null
                    }
                },
                categories:
                {
                    default: 
                    { 
                        appenders: [ 'out', 'rolling', 'mqtt' ], 
                        level: this._config.logging.logLevel || 'debug', 
                        layout: { type: 'coloured' } 
                    },
                },
            });

        this._logger = log4js.getLogger();

        ON_DEATH((signal, err) =>
        {
            this.logger.info('OHRuleServer::Death - encountered exiting');
            mqttAppender.end();

            if (this._mqttClient && this._mqttClient.connected)
            {
                this._mqttClient.end();
            }
            process.exit(0);
        });

        this.logger.debug('OHRuleServer::constructor - Construction complete');
    }
    
    get logger() { return this._logger; }
    get items() { return this._items; }
    get modules() { return this._modules; }
    get config() { return this._config; }
    
    async start(callback) 
    {
        var that = this;

        this.logger.info('OHRuleServer::start - Start up in progress');
        let ohUrl = 'http://' + this._config.OpenHab.OHServerAddress + ':' + this._config.OpenHab.OHServerPort + HOSTPATH;
        this.logger.info(`OHRuleServer::start - OpenHab web URL = ${ohUrl}`);
        let ohRulesDir = this._config.rulesFolder || "../rulesFolder";

        if (!path.isAbsolute(ohRulesDir))
        {
            ohRulesDir = path.resolve(__dirname, '../', ohRulesDir);
        }

        this.logger.info(`OHRuleServer::start - Rules directory = ${ohRulesDir}`);

        if (this._config.mqttLocalServer.use == true)
        {
            // Host the server here
            let net = require('net');
            let aedes = require('aedes')();
            const identities = require('./etc/pwd.json');

            aedes.authenticate = (_client, username, password, callback) =>
            {
                let thisPassword = new TextDecoder().decode(password);
        
                if (username.toLowerCase() in identities && identities[username.toLowerCase()] === thisPassword)
                {
                    callback(null, true);
                }
                else
                {
                    let err = new Error("Authentication Error");
                    err.returnCode = 4;
                    callback(err, null);
                }
            };

            this._mqttServer = await ((handle, port) =>
            {
                return new Promise((resolve, reject) =>
                {
                    let server = net.createServer(handle);

                    server.listen(port, () =>
                    {
                        this.logger.info("OHRuleServer::start - Internal MQTT server started")
                        resolve(server);
                    })
                });
            })(aedes.handle, this._config.mqttLocalServer.port || 1883);
        }

        this._mqttClient = mqtt.connect(this._config.mqtt.host, this._config.mqtt.auth);

        this._mqttClient.on('connect', () =>
        {
            this.logger.info('OHRuleServer::start - MQTT connected');
            this._mqttClient.subscribe(this._config.mqtt.subscribe);
        });
        
        this._mqttClient.on('error', (err) =>
        {
            this.logger.error(`OHRuleServer::start - Unable to connect to MQTT server: ${err.message}`);
        });

        try
        {
            let itemCnt = await this._getItems(ohUrl);
            await this._getUtilities(UTILITIESDIR);
            let ruleCnt = await this._getRules(ohRulesDir);

            this.logger.info(`OHRuleServer::start - Found ${itemCnt} items and ${ruleCnt} rules`);
    
            _.each(that._items, (item) =>
            {
                item.on('commandSend', (command) =>
                {
                    this.logger.debug(`<topic=${util.format(that._config.mqtt.publish.command, item.name)};message=${command}`);
                    that._mqttClient.publish(util.format(that._config.mqtt.publish.command, item.name), command);
                });
                item.on('stateSet', (state) =>
                {
                    this.logger.debug(`<topic=${util.format(that._config.mqtt.publish.state, item.name)};message=${state}`);
                    that._mqttClient.publish(util.format(that._config.mqtt.publish.state, item.name), state);
                });
            });

            _.each(that._modules, (module) => { module.run(that); });

            that._mqttClient.on('message', (topic, message) =>
            {
                this.logger.debug(`>topic=${topic};message=${message}`);
                
                let itemName = that._getItemFromTopic(topic);
                let messageType = that._getTypeFromTopic(topic);
                
                this.logger.trace(`itemname = ${itemName} messageType = ${messageType}`);
                try
                {
                    if (itemName in that._items)
                    {
                        switch (messageType)
                        {
                            case 'command':
                                that._items[itemName].commandReceived(message);
                                break;
                            case 'state':
                                that._items[itemName].stateReceived(message);
                                break;
                            default:
                                this.logger.error(`Unrecognized message type received - ${messageType}`);
                        }
                    }
                    else
                    {
                        this.logger.warn(`item ${itemName} was not found at start up`);
                    }
                }
                catch (e)
                {
                    this.logger.error(`Failed to send ${messageType} ${message} to ${itemName}: ${e.message} - ${e.stack}`);
                }
            });
                    
            var changeSeen = false;
            
            // ohRules.on('ruleChange', () =>
            // {
            //     if (!changeSeen)
            //     {
            //         changeSeen = true;
            //         setTimeout(() => 
            //         {
            //             changeSeen = false;
            //             this.logger.debug('Will reload rules now');
            //         }, 5 * 1000);
            //     }
            // });

            setInterval(this._processRepeaters, 60 * 1000, this);
        }
        catch(err)
        {
            this.logger.error(`OHRuleServer::start - Initialization failed ${err.message}`);
            process.exit(4);
        }
    }

    addRepeater(minutes, func, user)
    {
        let min = parseInt(minutes);
        let handle = this._repeaterHandle++;

        if (typeof min == NaN)
        {
            this.logger.warn('OHRuleServer::this.addRepeater - Invalid argument minutes');
            handle = -1;
        }
        else if (typeof func !== "function")
        {
            this.logger.warn('OHRuleServer::this.addRepeater - Invalid argument func');
            handle = -1;
        }
        else
        {
            this._repeaters.push({ handle: handle, minutes: min, function: func, user: user });
        }

        return handle;
    }

    removeRepeater(handle)
    {
        this._repeaters = this._repeaters.filter(item => item.handler !== handle);
    }

    _processRepeaters(that)
    {
        var now = new Date();

        that._repeaters.forEach((element) =>
        {
            if (now.getMinutes % element.minutes == 0)
            {
                element.function(element.user);
            }
        });
    }

    _getItems(ohUrl)
    {
        var that = this;

        return new Promise( (resolve, reject) =>
        {
            http.get(ohUrl, (response) =>
            {
                let rawData = '';
                
                response.on('data', (chunk) => rawData += chunk);
                response.on('end', () =>
                {
                    try
                    {
                        this.logger.trace(rawData);
                        var itemArray = JSON.parse(rawData);
                        
                        _.each(itemArray, function(element, index, list)
                        {
                            let parsedType = element.type.split(':')[0];
                            that.logger.trace(`OHRuleServer::start - Processing ${element.name} of type ${ITEMTYPES[that._coerceType(parsedType)]}`);
                            
                            let typeInd = ITEMTYPES.indexOf(parsedType);
                            
                            if (typeInd == -1)
                            {
                                that.logger.warn(`OHRuleServer::start - Dropped ${element.name}; Unknown item type ${element.type}`);
                            }
                            else
                            {
                                that.logger.trace(`OHRuleServer::start - Constructing ${element.name} type ${ITEMTYPES[typeInd]} from ${JSON.stringify(element, null, 4)}`);
                                that._items[element.name] = new ohClasses[parsedType](element);

                                if (that.logger.level.levelStr == 'DEBUG')
                                {
                                    that._items[element.name].on("timerchange", (thisItem, reason, arg) => {
                                        switch (reason)
                                        {
                                            case "info":
                                                that.logger.debug(`OHRuleServer::ontimerchange [${thisItem.name}] set for ${arg.toString()}`);
                                            case "cleared":
                                                that.logger.debug(`OHRuleServer::ontimerchange [${thisItem.name}] cleared - ${arg.toString()}`);
                                                break;
                                            case "set":
                                                that.logger.debug(`OHRuleServer::ontimerchange [${thisItem.name}] set for ${arg.toString()}`);
                                                break;
                                            case "triggered":
                                                that.logger.debug(`OHRuleServer::ontimerchange [${thisItem.name}] triggered - ${arg.toString()}`);
                                                break;
                                            case "ignored":
                                                that.logger.debug(`OHRuleServer::ontimerchange [${thisItem.name}] ignored`);
                                                break;
                                            default:
                                                that.logger.debug(`OHRuleServer::ontimerchange [${thisItem.name}] unknown`);
                                        }
                                    });
                                }
                            }
                        });
                        
                        _.each(itemArray, function(element, index, list)
                        {
                            if (element.name in that._items)
                            {
                                that.logger.trace(`OHRuleServer::start - Processing ${element.name}`);
                                _.each(element.groupNames, function(groupName)
                                {
                                    that.logger.trace(`OHRuleServer::start - Processing parent ${groupName}`);
                                    if (groupName in that._items)
                                    {
                                        that._items[element.name].addParent(that._items[groupName]);
                                        that._items[groupName].addChild(that._items[element.name]);
                                    }
                                    else
                                    {
                                        that.logger.error(`OHRuleServer::start - Group Item ${groupName} not found from ${element.name}`);
                                    }
                                });
                            }
                            else
                            {
                                that.logger.error(`OHRuleServer::start - Item ${element.name} not found`);
                            }
                        });
                        
                        if (that.logger.level.levelStr == 'DEBUG')
                        {
                            _.each(that._items, function(element)
                            {
                                that.logger.trace(`OHRuleServer::start - Checking ${element.name}`);
                                _.each(element.parents, function(parent) 
                                {
                                    that.logger.trace(`OHRuleServer::start - \tFound ${parent.name}`);
                                    
                                    if (undefined == _.find(parent.children, function(item) { return item.name == element.name; }))
                                    {
                                        that.logger.error(`OHRuleServer::start - Item ${item.name} not linked to ${element.name}`);
                                    }
                                });
                            });
                        }
                    }
                    catch (e)
                    {
                        this.logger.error(`OHRuleServer::start - Unable to parse items from OpenHab - ${e.message} \n ${e.stack}`);
                        this.logger.trace(util.inspect(itemArray));
                        reject(e);
                        return;
                    }
                    
                    resolve(_.size(that._items));
                });
                response.on('error', (err) => 
                { 
                    this.logger.error(`OHRuleServer::start - Error Occurred: ${err.message}`); 
                    reject(err); 
                });
            });
        });
    }

    _getUtilities(ohUtilityDir, callback)
    {
        var that = this;
        module.exports.OHUtility = [];

        return new Promise( (resolve, reject) => 
        {
            try
            {
                var walker  = walk.walk(ohUtilityDir, { followLinks: false, filters: [ 'node_modules' ] });
                walker.on('file', function(root, stat, next) 
                {
                    if (stat.type === 'file')
                    {
                        var current = path.join(root, stat.name).replace(/\\/g, '/');		// Windows path delimiters do not work for require
                        var extname = path.extname(current);

                        if (extname === '.js')
                        {
                            that.logger.debug(`OHRuleServer:_getUtilities - Getting ${current}`);
                            let utilMod = require(current);

                            if (utilMod)
                            {
                                let fileroot = path.basename(current).substr(0, path.basename(current).length - 3);
                                module.exports.OHUtility[fileroot] = utilMod;
                            }
                        }
                    }

                    next();
                });
                
                walker.on('errors', (root, nodeStatsArray, next) =>
                {
                    that.logger.warn('OHRuleServer:_getUtilities - Error occured');
                    that.logger.warn('1\t' + util.inspect(nodeStatsArray));
                    
                    var error = new Error(nodeStatsArray[0].error);
                    reject(error);
                });

                walker.on('end', function() 
                {
                    that.logger.debug('OHRuleServer:_getUtilities - End of utilities');
                    resolve(_.size(that._modules));
                });
                
                // fs.watch(ohRulesDir, (event, filename) => 
                // {
                //     this.logger.debug('OHRules:getRules - Rule change detected - event=${};filename=${}', event, filename);
                //     that.emit('ruleChange');
                // });
            }
            catch(e)
            {
                reject(e);
            }
        });
    }

    _getRules(ohRulesDir, callback)
    {
        var that = this;

        return new Promise( (resolve, reject) =>
        {
            try
            {
                var walker  = walk.walk(ohRulesDir, { followLinks: false, filters: [ 'node_modules' ] });
                walker.on('file', function(root, stat, next) 
                {
                    if (stat.type === 'file')
                    {
                        var current = path.join(root, stat.name).replace(/\\/g, '/');		// Windows path delimiters do not work for require
                        var extname = path.extname(current);
                        that.logger.debug(`OHRuleServer:_getRules - Getting ${current}`);

                        if (extname === '.js')
                        {
                            var module = require(current);

                            if (module)
                            {
                                if (Array.isArray(module))
                                {
                                    that._modules = that._modules.concat(module);
                                }
                                else
                                {
                                    that._modules.push(module);
                                }
                            }
                        }
                    }

                    next();
                });
                
                walker.on('errors', (root, nodeStatsArray, next) =>
                {
                    that.logger.warn('OHRuleServer:_getRules - Error occured');
                    that.logger.warn('1\t' + util.inspect(nodeStatsArray));
                    
                    var error = new Error(nodeStatsArray[0].error);
                    reject(error);
                });

                walker.on('end', function() 
                {
                    that.logger.debug('OHRuleServer:_getRules - End of rules');
                    resolve(_.size(that._modules));
                });
                
                // fs.watch(ohRulesDir, (event, filename) => 
                // {
                //     this.logger.debug('OHRules:getRules - Rule change detected - event=${};filename=${}', event, filename);
                //     that.emit('ruleChange');
                // });
            }
            catch(e)
            {
                reject(e);
            }
        });
    }

    _isDirSync(aPath) 
    {
        try 
        {
            return fs.statSync(aPath).isDirectory();
        } 
        catch (e) 
        {
            if (e.code === 'ENOENT') 
            {
                return false;
            } 
            else 
            {
                throw e;
            }
        }
    }
        
    _coerceType(rawType)
    {
        var result = ITEMTYPES.indexOf(rawType);
        
        return (result == 0)? 0 : result;
    }

    _getItemFromTopic(topic)
    {
        let end = topic.lastIndexOf('/');
        let start = topic.lastIndexOf('/', end - 1);
        
        return topic.substring(start + 1, end);
    }
    
    _getTypeFromTopic(topic)
    {
        let end = topic.lastIndexOf('/');
    
        return topic.substr(end + 1);
    }
    
};

module.exports.OHRuleServer = OHRuleServer;
module.exports.OHRuleBase = require('./OHClasses/OHRuleBase');
//module.exports.OHUtilities = require('./OHUtilities');
