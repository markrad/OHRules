'use strict';

const util = require('util');
const EventEmitter = require('events');
const OHItem = require('./OHItem');
const OHItemCommandTarget = require('./OHItemCommandTarget');

const logger = require('log4js').getLogger();

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
                logger.warn(`OHItemSwitch:coerceCommand [${this.name}] Unknown type for command ${command}`);
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
        
        logger.trace(`OHItemSwitch:coerceState [${this.name}] - Coercing state ${state} to ${newState}`);
        
        return newState;
    }
}

module.exports = OHItemSwitch;