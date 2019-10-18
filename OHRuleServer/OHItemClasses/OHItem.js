'use strict';

const util = require('util');
const EventEmitter = require('events');

const logger = require('log4js').getLogger();

class OHItem extends EventEmitter
{
    constructor(jsonObj)
    {
        super();
        logger.trace(`OHItem:constructor - Creating ${jsonObj.name} type ${jsonObj.type}`);
        logger.trace(`OHItem:constructor - Create from \r\n${JSON.stringify(jsonObj, null, 4)}`);
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
        logger.debug(`OHItem:coerceCommand [${this.name}] - state coerced`);
        return command;
    }
    
    coerceState(state)
    {
        return state;
    }
    
    stateReceived(state)
    {
        logger.debug(`OHItem:stateReceived [${this.name}] - received ${state}`);
        
        var oldState = (this.state == undefined)? '' : this.state;

        this._state = this.coerceState(state); 
        
        if (oldState != this.state)
        {
            logger.debug(`OHItem:stateReceived [${ this.name}] - state changed from ${oldState} to ${this.state}`);
            this.emit('stateChange', oldState, this.state);
        }
    }
    
    get name() { return this._name; }
    get state() { return this._state; }
    set state(value) 
    { 
        logger.debug(`OHItem:set state [${this.name}] - received ${this.coerceCommand(value)}`);
        
        this.emit('stateSet', this.coerceCommand(value));
    }
    get parents() { return this._parents; }
    get tags() { return this._tags; }
    get category() { return this._category; }
}

module.exports = OHItem;