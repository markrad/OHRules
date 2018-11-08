'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events');
const http = require('http');
const _ = require('underscore');

var types = [ 'Group', 'Switch', 'Dimmer', 'DateTime', 'Number', 'Contact', 'String' ];
var ohClasses = {}

_.each(types, function(element, index, list)
{
    ohClasses[element] = require('./OHItem' + element);
});

const _hostPath = '/rest/items';

var OHItemType =
{
    UNKNOWN : 0,
    GROUP : 1,
    SWITCH : 2,
    DIMMER : 3,
    DATETIME : 4,
    NUMBER : 5,
    CONTACT : 6,
    STRING : 7,
};

function coerceType(rawType)
{
    var result = types.indexOf(rawType);
    
    return (result == 0)? 0 : result;
}

var priv = Symbol();

class OHItemFactory extends EventEmitter
{
    constructor(serverAddress, serverPort)
    {
        super();

        this[priv] = {};
        this[priv].serverAddress = serverAddress;
        this[priv].serverPort = serverPort || 8080;
        this[priv].items = {};

        winston.silly("OHFactory: Contructed with %s:%i", this[priv].serverAddress, this[priv].serverPort);
    }
    
    get items() { return this[priv].items; }
    
    getItems()
    {
        var that = this;
        let ohUrl = util.format('http://%s:%i%s', this[priv].serverAddress, this[priv].serverPort, _hostPath); 
        winston.info("OpenHab web URL = %s", ohUrl);
        
        http.get(ohUrl, (response) =>
        {
            let rawData = '';
            
            response.on('data', (chunk) => rawData += chunk);
            response.on('end', () =>
            {
                var itemArray = '';
                
                try
                {
                    winston.silly(rawData);
                    itemArray = JSON.parse(rawData);
                    
                    _.each(itemArray, function(element, index, list)
                    {
                        winston.silly('OHItemFactory:getItems - Processing %s of type %s', element.name, types[coerceType(element.type)]);
                        
                        let typeInd = types.indexOf(element.type)
                        
                        if (typeInd == -1)
                        {
                            winston.warn('OHItemFactory:getItems - Dropped %s; Unknown item type %s', element.name, element.type);
                        }
                        else
                        {
                            winston.silly('OHItemFactory:getItems - Constructing %s type %s from %s', element.name, types[typeInd], JSON.stringify(element, null, 4));
                            that[priv].items[element.name] = new ohClasses[element.type](element);
                        }
                    });
                    
                    _.each(itemArray, function(element, index, list)
                    {
                        if (element.name in that[priv].items)
                        {
                            winston.silly('OHItemFactory:getItems - Processing %s', element.name);
                            _.each(element.groupNames, function(groupName)
                            {
                                winston.silly('OHItemFactory:getItems - Processing parent %s', groupName);
                                if (groupName in that[priv].items)
                                {
                                    that[priv].items[element.name].addParent(that[priv].items[groupName]);
                                    that[priv].items[groupName].addChild(that[priv].items[element.name]);
                                }
                                else
                                {
                                    winston.error('OHItemFactory:getItems - Group Item %s not found from %s', groupName, element.name);
                                }
                            });
                        }
                        else
                        {
                            winston.error('OHItemFactory:getItems - Item %s not found', element.name);
                        }
                    });
                    
                    if (winston.level == 'debug')
                    {
                        _.each(that[priv].items, function(element)
                        {
                            winston.silly('OHItemFactory:getItems - Checking %s', element.name);
                            _.each(element.parents, function(parent) 
                            {
                                winston.silly('OHItemFactory:getItems - \tFound %s', parent.name);
                                
                                if (undefined == _.find(parent.children, function(item) { return item.name == element.name; }))
                                {
                                    winston.error('OHItemFactory:getItems - Item %s not linked to %s', item.name, element.name);
                                }
                            });
                        });
                    }
                }
                catch (e)
                {
                    winston.error('Unable to parse items from OpenHab - %s', e.message);
                    winston.error(e.stack);
                    winston.silly(util.inspect(itemArray));
                    this.emit('error', e);
                }
                
                this.emit('items', _.size(that[priv].items));
            });
            response.on('error', (err) => 
            { 
                winston.error("Error Occurred: " + err.message); 
                this.emit('error', err); 
            });
        });
    }
}

module.exports.OHItemFactory = OHItemFactory;
module.exports.OHItemType = OHItemType;