'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events');

var priv = Symbol();

class OHItem extends EventEmitter
{
    constructor(jsonObj)
    {
        super();
        winston.silly('OHItem:constructor - Creating %s type %s', jsonObj.name, jsonObj.type, { 'OHItem':  jsonObj.name });
        winston.silly('OHItem:constructor - Create from \r\n%s', JSON.stringify(jsonObj, null, 4), { 'OHItem':  jsonObj.name });
        this[priv] = {};
        this[priv].name = jsonObj.name;
        this[priv].state = '';
        this[priv].parents = [];
        this[priv].meta = { "OHItem": this.name };
        process.nextTick(() =>
        {
            this.stateReceived(jsonObj.state);
        });
    }
    
    addParent(parent)
    {
        this[priv].parents.push(parent);
    }
    
    coerceCommand(command)
    {
        winston.debug('OHItem:stateReceived [%s] - state coerced', this.name, this.meta);
        return command;
    }
    
    coerceState(state)
    {
        return state;
    }
    
    stateReceived(state)
    {
        winston.debug('OHItem:stateReceived [%s] - received %s', this[priv].name, state, this.meta);
        
        var oldState = this[priv].state;

        this[priv].state = this.coerceState(state); 
        this.emit('stateChange', oldState, this.state);
        
        if (oldState != this[priv].state)
        {
            winston.debug('OHItem:stateReceived [%s] - state changed from %s to %s', this.name, oldState, this[priv].state, this.meta);
        }
    }
    
    get name() { return this[priv].name; }
    get meta() { return this[priv].meta; }
    get state() { return this[priv].state; }
    set state(value) 
    { 
        winston.debug('OHItem:set state [%s] - received %s', this.name, this.coerceCommand(value), this.meta);
        
        this.emit('stateSet', this.coerceCommand(value));
    }
    get parents() { return this[priv].parents; }
}

module.exports = OHItem;