'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events');
const OHItem = require('./OHItem');

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
        winston.silly('OHItemSwitch:coerceState [%s] - Coercing state %s to %s', this.name, state, newState, this.meta);
        
        return newState;
    }
}

module.exports = OHItemContact;