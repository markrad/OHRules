'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events');
const moment = require('moment');
const OHItem = require('./OHItem');

var priv = Symbol();

class OHItemDateTime extends OHItem
{
    constructor(jsonObj)
    {
        super(jsonObj);
    }
    
    coerceState(state)
    {
        winston.debug('OHItemDateTime:coerceState: [%s] coercing %s', this.name, state, this.meta);
        return (state == "NULL")? moment() : moment(state);
    }
}

module.exports = OHItemDateTime;