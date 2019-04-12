'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events');
const OHItem = require('./OHItem');
const OHItemSwitch = require('./OHItemSwitch');
const OHItemCommandTarget = require('./OHItemCommandTarget');

class OHItemDimmer extends OHItemSwitch
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
                return command == 'ON'? 100 : 0;
            case "number":
                return "" + (number > 100
                    ? 100 
                    : number < -1
                    ? 0
                    : number);
            case "boolean":
                return (command == true)? "100" : "0";
            default:
                winston.warn("OHItemSwitch:coerceCommand [%s] Unknown type for command %s", this.name, command, this.meta);
                return command;
        }
    }

    coerceState(state)
    {
        let stateStr = state.toString();
        let newState = NaN;

        switch (stateStr)
        {
            case "ON":
                newState = 100;
                break;
            case "OFF":
                newState = 0;
                break;
            default:
                newState = parseInt(stateStr);
                break;
        }
        
        winston.silly('OHItemSwitch:coerceState [%s] - Coercing state %s to %s', this.name, state, newState, this.meta);
        
        return newState;
    }
    
    setLevel(newLevel)
    {
        this.sendCommand(newLevel);
    }
}

module.exports = OHItemDimmer;