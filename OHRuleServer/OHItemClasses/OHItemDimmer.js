'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events');
const OHItem = require('./OHItem');
const OHItemCommandTarget = require('./OHItemCommandTarget');

var priv = Symbol();

class OHItemDimmer extends OHItem
{
    constructor(jsonObj)
    {
        super(jsonObj);
    }
    
    coerceCommand(command)
    {
        switch (typeof command)
        {
            case "string":
                return command;
            case "number":
                return "" + number;
            case "boolean":
                return (command == true)? "100" : "0";
            default:
                winston.warn("OHItemSwitch:coerceCommand [%s] Unknown type for command %s", this.name, command, this.meta);
                return command;
        }
    }

    coerceState(state)
    {
        let newState = parseInt(state);
        
        winston.silly('OHItemSwitch:coerceState [%s] - Coercing state %s to %s', this.name, state, newState, this.meta);
        
        return newState;
    }
    
    setLevel(newLevel)
    {
        this.sendCommand(newLevel);
    }
}

module.exports = OHItemCommandTarget;