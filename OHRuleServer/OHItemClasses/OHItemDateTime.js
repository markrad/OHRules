'use strict';

const util = require('util');
const EventEmitter = require('events');
const moment = require('moment');
const OHItem = require('./OHItem');

const logger = require('log4js').getLogger();

class OHItemDateTime extends OHItem
{
    constructor(jsonObj)
    {
        super(jsonObj);
    }
    
    coerceState(state)
    {
        logger.debug(`OHItemDateTime:coerceState: [${this.name}] coercing ${state}`);
        return (state == "NULL")? moment() : moment(new Date(state));
    }
}

module.exports = OHItemDateTime;