'use strict';

const util = require('util');
var EventEmitter = require('events').EventEmitter;
var http = require('http');
var moment = require('moment');
var winston = require('winston');
var config = require('../config');

var jsonDirective = '?type=json'

EventEmitter.defaultMaxListeners = 20;

var ohItemType =
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

function ohItem(jsonObj)
{
	EventEmitter.call(this);

    this.coerceState = function(rawState)
    {
        if (rawState === undefined)
        {
            winston.debug('State actually undefined - in the JavaScript sense');
        }

        winston.silly(name + ' ' + that._type + ' ' + rawState);
        return rawState;
    };

	var that = this;
	var name = jsonObj.name;
    this._type = ohItemType.UNKNOWN;
    var state = this.coerceState(jsonObj.state);
	this._restUrl = jsonObj.link;
	this.parents = {};
	this.children = {};
    var actionAt = null;
    var timeout = null;
    var waitForSettle = 0;

    this.on('newListner', () => winston.debug(name + ' has ' + that.listenerCount() + ' listeners'));
	
	this.__defineGetter__('name', () => { return name; });
	this.__defineGetter__('type', () => { return this._type; });
	this.__defineGetter__('state', () => { return state; });
	//this.__defineGetter__('restUrl', () => { return restUrl; });
    this.__defineGetter__('timerRunning', () => { return actionAt != null; });
	
	this.__defineSetter__('state', (value) => 
	{ 
		let oldState = state;

        this.cancelTimer();
        state = that.coerceState(value); 
		this.emit('state', that, oldState, state);
	});

    this.coerceCommand = (command) => { return command.toString(); }

    this.coerceState = (rawState) => { return rawState.toString(); }

    this.requiredState = (command) => { return command; }

    this.cancelTimer = function()
    {
        winston.silly('cancelTimer: timerRunning for ' + this.name + ' = ' + that.timerRunning);

        if (that.timerRunning)
        {
            winston.silly(new Error().stack);
        }

        if (waitForSettle && 0 == --waitForSettle)
        {
            this.emit('settled');
        }

        if (that.timerRunning)
        {
            actionAt = null;
            clearTimeout(timeout);
        }
    }

    this.commandReceived = function(command)
    {
        this.emit('command', name, command);
    }

    this.commandSend = function(command)
    {
        this.emit('commandSend', name, this.coerceCommand(command));
        waitForSettle += 1;

        // In case for some reason we don't see the state update timeout the settle delay
        setTimeout(() => { if (waitForSettle && 0 == --waitForSettle) this.emit('settled'); }, config.misc.settleTimeout || 10000);
        return this;
    }

    this.commandSendWithTimeoutAt = function(command, sendAt, nextCommand)
    {
        winston.debug('commandSendWithTimeoutAt: ' + this.name + '; state = ' + this.state + '; command = ' + command);
        winston.debug('actionAt = ' + ((actionAt == null)? 'null' : actionAt.toString()) + '; sendAt = ' + sendAt.toString());
        winston.debug('should run = ' + (this.state != this.requiredState(command) || (this.timerRunning && sendAt.isAfter(actionAt))));

        if (this.state != this.requiredState(command) || (this.timerRunning && sendAt.isAfter(actionAt)))
        {
            this.commandSend(command);
            this.commandSendAt(sendAt, nextCommand);
        }

        return this;
    };

    this.commandSendWithTimeoutIn = function(command, sendIn, nextCommand)
    {
        return this.commandSendWithTimeoutAt(command, moment().add(sendIn), nextCommand);
    }

    this.commandSendAt = function(sendAt, command)
    {
        var delay = sendAt.diff(moment(), 'milliseconds');
        
        winston.debug('commandSendAt: ' + this.name + ';' + (sendAt? sendAt.toString() : 'null'));
        winston.debug('in milliseconds: ' + delay);
        
        this.once('settled', function()
        {
            winston.debug(that.name + ' settled');
            
            actionAt = sendAt;

            timeout = setTimeout(() =>
            {
                actionAt = null;
                that.commandSend(command);
            }, delay);
        });

        if (waitForSettle == 0)
        {
            this.emit('settled');
        }

        return this;
    }

    this.commandSendIn = function(interval, command)
    {
        return this.commandSendAt(moment().add(interval), command);
    }

    this.stateSet = function(requestedState)
    {
        //state = that.coerceState(value); 
        this.emit('stateSet', name, this.coerceCommand(requestedState));
    }
	
	this.toString = function()
	{
		return util.format('name=%s;type=%s;state=%s', this.name, this.type, this.state);
	}
}

util.inherits(ohItem, EventEmitter);

var ohItemFactory = function(/*jsonObj*/)
{
}

ohItemFactory.coerceType = function(rawType)
{
    return (config.openhab.version == 2? ohItemFactory.coerceType2(rawType) : ohItemFactory.coerceType1(rawType));
}

ohItemFactory.coerceType2 = function(rawType)
{
    return rawType === 'Group'
        ? ohItemType.GROUP
        : rawType === 'Switch'
        ? ohItemType.SWITCH
        : rawType === 'Dimmer'
        ? ohItemType.DIMMER
        : rawType === 'DateTime'
        ? ohItemType.DATETIME
        : rawType === 'Number'
        ? ohItemType.NUMBER
        : rawType === 'Contact'
        ? ohItemType.CONTACT
        : rawType === 'String'
        ? ohItemType.STRING
        : ohItemType.UNKNOWN;
    return rawType;
};

ohItemFactory.coerceType1 = function(rawType)
{
    return rawType === 'GroupItem'
        ? ohItemType.GROUP
        : rawType === 'SwitchItem'
        ? ohItemType.SWITCH
        : rawType === 'DimmerItem'
        ? ohItemType.DIMMER
        : rawType === 'DateTimeItem'
        ? ohItemType.DATETIME
        : rawType === 'NumberItem'
        ? ohItemType.NUMBER
        : rawType === 'ContactItem'
        ? ohItemType.CONTACT
        : rawType === 'StringItem'
        ? ohItemType.STRING
        : ohItemType.UNKNOWN;
    return rawType;
}

ohItemFactory.ohItems = {};

ohItemFactory.getItem = function(jsonObj)
{
    var type = ohItemFactory.coerceType(jsonObj.type);

    switch (type)
    {
        case ohItemType.CONTACT:
            return new ohItemContact(jsonObj);
        case ohItemType.DATETIME:
            return new ohItemDate(jsonObj);
        case ohItemType.DIMMER:
            return new ohItemDimmer(jsonObj);
        case ohItemType.GROUP:
            return new ohItemGroup(jsonObj);
        case ohItemType.NUMBER:
            return new ohItemNumber(jsonObj);
        case ohItemType.STRING:
            return new ohItemString(jsonObj);
        case ohItemType.SWITCH:
            return new ohItemSwitch(jsonObj);
        default:
            return new ohItem(jsonObj);
    }
}

ohItemFactory.getItems = function(parsedData, callback)
{
    var groupCount = 0;
    let itemArray = (config.openhab.version == 1)? parsedData.item : parsedData;

    for (var key in itemArray)
    {
        ohItemFactory.ohItems[itemArray[key].name] = ohItemFactory.getItem(itemArray[key]);
        
        var work = ohItemFactory.ohItems[itemArray[key].name];
        if (ohItemFactory.ohItems[itemArray[key].name].type == ohItemType.GROUP)
        {
            groupCount++;
            //winston.silly("> group " + work.name);
            ohItemFactory.ohItems[itemArray[key].name].once('initialised', function(item) 
            {
                //winston.silly("< group " + item.name + " - " + groupCount.toString() + " left");
              
                if (--groupCount == 0)
                {
                    // Put this in to a different context
                    process.nextTick(() => callback(null));
                }
            });

        }
    }
}

function ohItemGroup(jsonObj)
{
    ohItem.call(this, jsonObj);
    var that = this;

    that._type = ohItemType.GROUP;
	
	var populateLinks = function(itemName)
	{
        var childItem;

		let interval = setInterval(function()
		{
            try
            {
                winston.silly('Populating ', itemName);

                childItem = ohItemFactory.ohItems[itemName];

                if (childItem != undefined)
                {
                    winston.silly('Found child');

                    that.children[itemName] = childItem;
                    
                    winston.silly('Add to child\'s parents');

                    childItem.parents[that.name] = that;
                    childItem.on('state', (name, oldState, state) => { that.emit('state', name, oldState, state); });
                    clearInterval(interval);
                    that.emit('initialised', that);
                }
                else
                {
                    winston.silly('item not found');
                }
            }
            catch (exp)
            {
                winston.error(util.inspect(exp));
                winston.error(itemName);
            }
		}, 50);
	}

    let ohUrl = that._restUrl + jsonDirective;
    
    var pRequest = http.get(ohUrl, function(response)
    {
        let rawData = '';
        
        response.on('data', (chunk) => rawData += chunk);
        response.on('end', () =>
        {
            try
            {
                let parsedData = JSON.parse(rawData);
                
                if (parsedData.members != undefined && parsedData.members.length > 0)
                {
                    if (Array.isArray(parsedData.members))
                    {
                        for (var key in parsedData.members)
                        {
                            if (parsedData.members[key].name == undefined)
                            {
                                winston.debug(rawData);
                                winston.debug('key=' + key);
                                winston.debug(util.inspect(parsedData));
                            }
                            //console.log('\t' + that.name + '/' + parsedData.members[key].name);
                            populateLinks(parsedData.members[key].name);
                        }
                    }
                    else
                    {
                        //console.log('\t' + that.name + '/' + parsedData.members.name);
                        populateLinks(parsedData.members.name);
                    }
                }
                else
                {
                    that.emit('initialised', that);
                }
            }
            catch (e)
            {
                winston.error(e.message);
            }
        });
    });
}

util.inherits(ohItemGroup, ohItem);

function ohItemNumber(jsonObj)
{
    ohItem.call(this, jsonObj);
    var that = this;
    this.state = this.coerceState(jsonObj.state);

    that._type = ohItemType.NUMBER;

    this.coerceState = function(rawState)
    {
        winston.silly("coerceState: ohItemNumber - returning number: " + rawState);

        var work = Number(rawState);
        winston.silly("coerceState: returning " + work);

        return work;
    };
}

util.inherits(ohItemNumber, ohItem);

function ohItemString(jsonObj)
{
    ohItem.call(this, jsonObj);
    var that = this;

    that._type = ohItemType.STRING;

    this.coerceState = function(rawState)
    {
        winston.silly("coerceState: ohItemString - returning string: " + rawState);

        var work = rawState.toString();
        winston.silly("coerceState: returning " + work);

        return work;
    };
}

util.inherits(ohItemString, ohItem);

function ohItemSwitch(jsonObj)
{
    ohItem.call(this, jsonObj);
    var that = this;

    process.nextTick((newState) => this.state = newState, jsonObj.state);

    that._type = ohItemType.CONTACT;

    this.coerceCommand = function(command)
    {
        
        return (command.toString().toUpperCase() == "ON" || command.toString().toUpperCase() == "OFF")? 
            command.toString().toUpperCase():
            (command)?
            "ON":
            "OFF";
    };

    this.coerceState = function(rawState)
    {
        winston.silly("coerceState: ohItemSwitch - returning value: " + rawState);

        var work = (rawState == 'ON')? true : false;
        winston.silly("coerceState: returning " + work);
        
        return work;
    };

	this.__defineGetter__('isOn', () => { return this.state == true; });
    this.__defineGetter__('isOff', () => { return this.state == false; });

    this.turnOn = () => 
    {
        that.commandSend('ON');
        return this;
    }

    this.turnOnAt = (sendAt) => 
    {
        that.commandSendAt(sendAt, 'ON');
        return this;
    }

    this.turnOnIn = (sendIn) => 
    {
        that.commandSendIn(sendIn, 'ON');
        return this;
    }

    this.turnOff = () => 
    {
        that.commandSend('OFF');
        return this;
    }
    
    this.turnOffAt = (sendAt) => 
    { 
        that.commandSendAt(sendAt, 'OFF');
        return this;
    };

    this.turnOffIn = (sendIn) => 
    {
        that.commandSendIn(sendIn, 'OFF');
        return this;
    }
}

util.inherits(ohItemSwitch, ohItem);

function ohItemContact(jsonObj)
{
    ohItem.call(this, jsonObj);
    var that = this;
    this.state = this.coerceState(jsonObj.state);

    that._type = ohItemType.CONTACT;

    this.coerceState = function(rawState)
    {
        winston.silly("coerceState: ohItemContact - returning number: " + rawState);

        var work = rawState == 'CLOSED'? true : false;
        winston.silly("coerceState: returning " + work);
        
        return work;
    };
}

util.inherits(ohItemContact, ohItem);

function ohItemDate(jsonObj)
{
    ohItem.call(this, jsonObj);
    var that = this;
    this.state = this.coerceState(jsonObj.state);

    that._type = ohItemType.DATETIME;

    this.coerceState = function(rawState)
    {
        winston.silly("coerceState: ohItemDate - returning date: " + rawState);

        var work = new moment(rawState.toString());
        winston.silly("coerceState: returning " + work);
        
        return work;
    };
}

util.inherits(ohItemDate, ohItem);

function ohItemDimmer(jsonObj)
{
    ohItem.call(this, jsonObj);
    var that = this;
    this.state = this.coerceState(jsonObj.state);

    that._type = ohItemType.DATETIME;

    this.coerceCommand = function(command)
    {
        var result = (typeof command == 'boolean')?
            (command)? "100" : "OFF":
            command.toString();

        return result;
    }

    this.coerceState = function(rawState)
    {
        winston.silly("coerceState: ohItemDimmer - returning value: " + rawState);

        var work = rawState.toString() == 'OFF'? 
            0 : 
            rawState.toString() == 'ON'?
            100 :
            Number(rawState);
        winston.silly("coerceState: returning " + work);
        
        return work;
    };

    this.requestedState = function(command)
    {
        return 
            typeof command == "boolean"?
                command?
                    100 : 0:
            command;
    }

	this.__defineGetter__('isOn', () => { return this.state != 0; });
    this.__defineGetter__('isOff', () => { return this.state == 0; });
    this.setLevel = (level) => that.commandSend(level);
    this.setLevelAt = (level) => that.commandSendAt(sendAt, level);
    this.setLevelIn = (level) => that.commandSendIn(sendIn, level);
    this.turnOn = () => that.setLevel(100);
    this.turnOff = () => that.setLevel(0);
    this.turnOnAt = () => that.setLevelAt(sendAt, 100);
    this.turnOnIn = () => that.setLevelAtIn(sendIn, 100);
}

util.inherits(ohItemDimmer, ohItem);

module.exports.ohItem = ohItem;
module.exports.ohItems = ohItemFactory.ohItems;
module.exports.ohItemType = ohItemType;
module.exports.ohItemFactory = ohItemFactory;
