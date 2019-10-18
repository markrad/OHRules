'use strict';

const util = require('util');
const EventEmitter = require('events');
const OHItem = require('./OHItem');
const OHItemSwitch = require('./OHItemSwitch');
const OHItemCommandTarget = require('./OHItemCommandTarget');

const logger = require('log4js').getLogger();

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
                return "" + (command > 100
                    ? 100 
                    : command < 0
                    ? 0
                    : command);
            case "boolean":
                return (command == true)? "100" : "0";
            default:
                logger.warn(`OHItemSwitch:coerceCommand [${this.name}] Unknown type for command ${command}`);
                return command;
        }
    }

    coerceState(state)
    {
        let stateStr = state.toString();
        let newState = NaN;

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
                newState = parseInt(stateStr);
                break;
        }
        
        logger.trace(`OHItemSwitch:coerceState [${this.name}] - Coercing state ${state} to ${newState}`);
        
        return newState;
    }
    
    setLevel(newLevel)
    {
        this.sendCommand(newLevel);
    }
}

module.exports = OHItemDimmer;