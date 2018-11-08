'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events');
const OHItem = require('./OHItem');

var priv = Symbol();

class OHItemGroup extends OHItem
{
    constructor(jsonObj)
    {
        super(jsonObj);
        this[priv] = {};
        this[priv].children = [];
    }
    
    addChild(child)
    {
        this[priv].children.push(child);
    }
    
    // coerceState(state)
    // {
        // return super.coerceState(state);
    // }

    get children() { return this[priv].children; }
}

module.exports = OHItemGroup;