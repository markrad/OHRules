'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events');
const OHItem = require('./OHItem');
const OHItemCommandTarget = require('./OHItemCommandTarget');

class OHItemSwitch extends OHItemCommandTarget
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
                return (command > 0)? "ON" : "OFF";
            case "boolean":
                return (command == true)? "ON" : "OFF";
            default:
                winston.warn("OHItemSwitch:coerceCommand [%s] Unknown type for command %s", this.name, command, this.meta, this.meta);
                return command;
        }
    }

    coerceState(state)
    {
        let stateStr = state.toString();
        let newState = -1;

        switch (stateStr)
        {
            case 'true':
            case "ON":
                newState = 100;
                break;
            case 'false':
            case "OFF":
                newState = 0;
                break;
            default:
                newState = NaN;
                break;
        }
        
        winston.silly('OHItemSwitch:coerceState [%s] - Coercing state %s to %s', this.name, state, newState, this.meta);
        
        return newState;
    }
}

module.exports = OHItemSwitch;