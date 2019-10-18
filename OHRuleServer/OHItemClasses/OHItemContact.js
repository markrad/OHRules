'use strict';

const util = require('util');
const EventEmitter = require('events');
const OHItem = require('./OHItem');

const logger = require('log4js').getLogger();

class OHItemContact extends OHItem
{
    constructor(jsonObj)
    {
        super(jsonObj);
    }

    coerceState(state)
    {
        let newState = 
            state == 'CLOSED'
            ? true
            : state == 'OPEN'
            ? false
            : NaN;
        logger.trace('OHItemSwitch:coerceState [${}] - Coercing state ${} to ${}', this.name, state, newState, this.meta);
        
        return newState;
    }
}

module.exports = OHItemContact;