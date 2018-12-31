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
}

module.exports = OHItemString;