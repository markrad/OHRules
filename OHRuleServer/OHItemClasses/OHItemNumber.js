'use strict';

const util = require('util');
const EventEmitter = require('events');
const OHItem = require('./OHItem');

const logger = require('log4js').getLogger();

class OHItemNumber extends OHItem
{
    constructor(jsonObj)
    {
        super(jsonObj);
    }

    coerceState(state)
    {
        let newState = parseFloat(state);
        
        logger.trace(`OHItemSwitch:coerceState [${this.name}] - Coercing state ${state} to ${newState}`);
        
        return newState;
    }
}

module.exports = OHItemNumber;
