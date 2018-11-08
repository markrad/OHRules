'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events');
const OHItem = require('./OHItem');

var priv = Symbol();

class OHItemNumber extends OHItem
{
    constructor(jsonObj)
    {
        super(jsonObj);
    }

    coerceState(state)
    {
        let newState = parseFloat(state);
        
        winston.silly('OHItemSwitch:coerceState [%s] - Coercing state %s to %s', this.name, state, newState, this.meta);
        
        return newState;
    }
}

module.exports = OHItemNumber;
