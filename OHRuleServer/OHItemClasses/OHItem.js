'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events');

class OHItem extends EventEmitter
{
    constructor(jsonObj)
    {
        super();
        winston.silly('OHItem:constructor - Creating %s type %s', jsonObj.name, jsonObj.type, { 'OHItem':  jsonObj.name });
        winston.silly('OHItem:constructor - Create from \r\n%s', JSON.stringify(jsonObj, null, 4), { 'OHItem':  jsonObj.name });
        this._name = jsonObj.name;
        this._tags = jsonObj.tags;
        this._category = jsonObj.category;
        this._state = '';
        this._parents = [];

        process.nextTick(() =>
        {
            this.stateReceived(jsonObj.state);
        });
    }
    
    addParent(parent)
    {
        this._parents.push(parent);
    }
    
    coerceCommand(command)
    {
        winston.debug('OHItem:coerceCommand [%s] - state coerced', this.name);
        return command;
    }
    
    coerceState(state)
    {
        return state;
    }
    
    stateReceived(state)
    {
        winston.debug('OHItem:stateReceived [%s] - received %s', this.name, state);
        
        var oldState = (this.state == undefined)? '' : this.state;

        this._state = this.coerceState(state); 
        
        if (oldState != this.state)
        {
            winston.debug('OHItem:stateReceived [%s] - state changed from %s to %s', this.name, oldState, this.state);
            this.emit('stateChange', oldState, this.state);
        }
    }
    
    get name() { return this._name; }
    get state() { return this._state; }
    set state(value) 
    { 
        winston.debug('OHItem:set state [%s] - received %s', this.name, this.coerceCommand(value));
        
        this.emit('stateSet', this.coerceCommand(value));
    }
    get parents() { return this._parents; }
    get tags() { return this._tags; }
    get category() { return this._category; }
}

module.exports = OHItem;