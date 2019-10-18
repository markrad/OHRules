'use strict';

const util = require('util');
const EventEmitter = require('events');
const OHItem = require('./OHItem');

const logger = require('log4js').getLogger();

class OHItemString extends OHItem
{
    constructor(jsonObj)
    {
        super(jsonObj);
    }

    commandReceived(cmd)
    {
        logger.debug(`OHItemString:commandReceived [${this.name}] - received ${cmd}`); 
        this.emit('commandReceived', cmd);
    }
 }

module.exports = OHItemString;