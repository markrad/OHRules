'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events');
const OHItem = require('./OHItem');

class OHItemString extends OHItem
{
    constructor(jsonObj)
    {
        super(jsonObj);
    }

    commandReceived(cmd)
    {
        winston.debug('OHItemString:commandReceived [%s] - received %s', this.name, cmd); 
        this.emit('commandReceived', cmd);
    }
 }

module.exports = OHItemString;