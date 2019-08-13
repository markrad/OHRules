'use strict'

const util = require('util');
const winston = require('winston');
const http = require('http');
const moment = require('moment');
const async = require('async');
const path = require('path');
const walk = require('walk');
const fs = require('fs');
const mqtt = require('mqtt');
const _ = require('underscore');

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, { 'colorize': true, 'timestamp' : function() { return moment().format(); } });
//winston.level = 'silly';

// Constants
const HOSTPATH = '/rest/items';
const ITEMTYPES = [ 'Group', 'Switch', 'Dimmer', 'DateTime', 'Number', 'Contact', 'String' ];
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
        winston.debug(util.inspect(config));
        
        module.exports.Config = config;
        this._config = config;
        this._mqttClient = null;
        this._items = {};
        this._modules = [];
        
        winston.level = this._config.winston.logLevel || 'debug';
        winston.debug('OHRuleServer::constructor - Construction complete');
    }
    
    get logger() { return winston; }
    get items() { return this._items; }
    get modules() { return this._modules; }
    get config() { return this._config; }
    
    async start(callback) 
    {
        var that = this;

        winston.info('OHRuleServer::start - Start up in progress');
        let ohUrl = 'http://' + this._config.OpenHab.OHServerAddress + ':' + this._config.OpenHab.OHServerPort + HOSTPATH;
        winston.info("OHRuleServer::start - OpenHab web URL = %s", ohUrl);
        let ohRulesDir = this._config.rulesFolder || "../rulesFolder";

        if (!path.isAbsolute(ohRulesDir))
        {
            ohRulesDir = path.resolve(__dirname, '../', ohRulesDir);
        }

        winston.info("OHRuleServer::start - Rules directory = %s", ohRulesDir);

        this._mqttClient = mqtt.connect(this._config.mqtt.host, this._config.mqtt.auth);

        this._mqttClient.on('connect', () =>
        {
            winston.info('MQTT connected');
            this._mqttClient.subscribe(this._config.mqtt.subscribe);
        });
        
        this._mqttClient.on('error', (err) =>
        {
            winston.error('Unable to connect to MQTT server: %s', err.message);
        });

        try
        {
            let itemCnt = await this._getItems(ohUrl);
            await this._getUtilities(UTILITIESDIR);
            let ruleCnt = await this._getRules(ohRulesDir);

            winston.info('OHRuleServer::start - Found %s items and %s rules', itemCnt, ruleCnt);
    
            _.each(that._items, (item) =>
            {
                item.on('commandSend', (command) =>
                {
                    winston.debug('<topic=%s;message=%s', util.format(that._config.mqtt.publish.command, item.name), command);
                    that._mqttClient.publish(util.format(that._config.mqtt.publish.command, item.name), command);
                });
                item.on('stateSet', (state) =>
                {
                    winston.debug('<topic=%s;message=%s', util.format(that._config.mqtt.publish.state, item.name), state);
                    that._mqttClient.publish(util.format(that._config.mqtt.publish.state, item.name), state);
                });
            });

            _.each(that._modules, (module) => { module.run(that); });

            that._mqttClient.on('message', (topic, message) =>
            {
                winston.debug('>topic=%s;message=%s', topic, message);
                
                let itemName = that._getItemFromTopic(topic);
                let messageType = that._getTypeFromTopic(topic);
                
                winston.silly('itemname = %s messageType = %s', itemName, messageType);
                try
                {
                    if (messageType == 'command')
                    {
                        that._items[itemName].commandReceived(message);
                    }
                    else if (messageType == 'state')
                    {
                        that._items[itemName].stateReceived(message);
                    }
                    else
                    {
                        winston.error('Unrecognized message type received - ' + messageType);
                    }
                }
                catch (e)
                {
                    winston.error('Failed to send %s %s to %s: %s - %s', messageType, message, itemName, e.message, e.stack);
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
            //             winston.debug('Will reload rules now');
            //         }, 5 * 1000);
            //     }
            // });
        }
        catch(err)
        {
            winston.error("OHRuleServer::start - Initialization failed " + err.message);
            process.exit(4);
        }

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
                        winston.silly(rawData);
                        var itemArray = JSON.parse(rawData);
                        
                        _.each(itemArray, function(element, index, list)
                        {
                            let parsedType = element.type.split(':')[0];
                            winston.silly('OHRuleServer::start - Processing %s of type %s', element.name, ITEMTYPES[that._coerceType(parsedType)]);
                            
                            let typeInd = ITEMTYPES.indexOf(parsedType);
                            
                            if (typeInd == -1)
                            {
                                winston.warn('OHRuleServer::start - Dropped %s; Unknown item type %s', element.name, element.type);
                            }
                            else
                            {
                                winston.silly('OHRuleServer::start - Constructing %s type %s from %s', element.name, ITEMTYPES[typeInd], JSON.stringify(element, null, 4));
                                that._items[element.name] = new ohClasses[parsedType](element);

                                if (winston.level == 'debug')
                                {
                                    that._items[element.name].on("timerchange", (thisItem, reason, arg) => {
                                        switch (reason)
                                        {
                                            case "info":
                                                winston.debug("OHRuleServer::ontimerchange [%s] set for %s", thisItem.name, arg.toString());
                                            case "cleared":
                                                winston.debug("OHRuleServer::ontimerchange [%s] cleared - %s", thisItem.name, arg);
                                                break;
                                            case "set":
                                                winston.debug("OHRuleServer::ontimerchange [%s] set for %s", thisItem.name, arg.toString());
                                                break;
                                            case "triggered":
                                                winston.debug("OHRuleServer::ontimerchange [%s] triggered - %s", thisItem.name, arg.toString());
                                                break;
                                            case "ignored":
                                                winston.debug("OHRuleServer::ontimerchange [%s] ignored", thisItem.name);
                                                break;
                                            default:
                                                winston.debug("OHRuleServer::ontimerchange [%s] unknown", thisItem.name);
                                        }
                                    });
                                }
                            }
                        });
                        
                        _.each(itemArray, function(element, index, list)
                        {
                            if (element.name in that._items)
                            {
                                winston.silly('OHRuleServer::start - Processing %s', element.name);
                                _.each(element.groupNames, function(groupName)
                                {
                                    winston.silly('OHRuleServer::start - Processing parent %s', groupName);
                                    if (groupName in that._items)
                                    {
                                        that._items[element.name].addParent(that._items[groupName]);
                                        that._items[groupName].addChild(that._items[element.name]);
                                    }
                                    else
                                    {
                                        winston.error('OHRuleServer::start - Group Item %s not found from %s', groupName, element.name);
                                    }
                                });
                            }
                            else
                            {
                                winston.error('OHRuleServer::start - Item %s not found', element.name);
                            }
                        });
                        
                        if (winston.level == 'debug')
                        {
                            _.each(that._items, function(element)
                            {
                                winston.silly('OHRuleServer::start - Checking %s', element.name);
                                _.each(element.parents, function(parent) 
                                {
                                    winston.silly('OHRuleServer::start - \tFound %s', parent.name);
                                    
                                    if (undefined == _.find(parent.children, function(item) { return item.name == element.name; }))
                                    {
                                        winston.error('OHRuleServer::start - Item %s not linked to %s', item.name, element.name);
                                    }
                                });
                            });
                        }
                    }
                    catch (e)
                    {
                        winston.error('OHRuleServer::start - Unable to parse items from OpenHab - %s', e.message);
                        winston.error(e.stack);
                        winston.silly(util.inspect(itemArray));
                        reject(e);
                        return;
                    }
                    
                    resolve(_.size(that._items));
                });
                response.on('error', (err) => 
                { 
                    winston.error("OHRuleServer::start - Error Occurred: " + err.message); 
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
                            winston.debug('OHRules:_getUtilities - Getting %s', current);
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
                    winston.warn('OHRules:_getUtilities - Error occured');
                    winston.warn('1\t' + util.inspect(nodeStatsArray));
                    
                    var error = new Error(nodeStatsArray[0].error);
                    reject(error);
                });

                walker.on('end', function() 
                {
                    winston.debug('OHRules:_getUtilities - End of utilities');
                    resolve(_.size(this._modules));
                });
                
                // fs.watch(ohRulesDir, (event, filename) => 
                // {
                //     winston.debug('OHRules:getRules - Rule change detected - event=%s;filename=%s', event, filename);
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
                        winston.debug('OHRules:_getRules - Getting %s', current);

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
                    winston.warn('OHRules:_getRules - Error occured');
                    winston.warn('1\t' + util.inspect(nodeStatsArray));
                    
                    var error = new Error(nodeStatsArray[0].error);
                    reject(error);
                });

                walker.on('end', function() 
                {
                    winston.debug('OHRules:_getRules - End of rules');
                    resolve(_.size(that._modules));
                });
                
                // fs.watch(ohRulesDir, (event, filename) => 
                // {
                //     winston.debug('OHRules:getRules - Rule change detected - event=%s;filename=%s', event, filename);
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
module.exports.OHRuleBase = require('./OHClasses/OhRuleBase');
//module.exports.OHUtilities = require('./OHUtilities');
