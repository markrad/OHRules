'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events');
const OHItem = require('./OHItem');

class OHItemGroup extends OHItem
{
    constructor(jsonObj)
    {
        super(jsonObj);
        this._children = [];
    }
    
    addChild(child)
    {
        this._children.push(child);
    }
    
    // coerceState(state)
    // {
        // return super.coerceState(state);
    // }

    get children() { return this._children; }
}

module.exports = OHItemGroup;