'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events');
const OHItem = require('./OHItem');
const moment = require('moment');

var priv = Symbol();

class OHItemCommandTarget extends OHItem
{
    constructor(jsonObj)
    {
        super(jsonObj);
        this[priv] = {};
        this[priv].pendingChange = false;
        this[priv].timerRunning = false;
        this[priv].timerMoment = null;
        this[priv].timer = null;
    }
    
    _commandSendAtImpl(command, timeAt)
    {
        winston.debug('OHItemCommandTarget:_commandSendAtImpl [%s] - Updating timer to %s', this.name, timeAt.toString(), this.meta);
        this[priv].timerMoment = timeAt;
        this[priv].timerRunning = true;
        this[priv].timer = setTimeout(() =>
        {
            this.commandSend(command);
            this.timerRunning = false;
            this.timerMoment = null;
        }, timeAt.diff(moment()));
    }
    
    coerceCommand(command)
    {
        return command;
    }
    
    commandReceived(cmd)
    {
        winston.debug('OHItemCommandTarget:commandReceived [%s] - received %s', this.name, cmd, this.meta);
        
        if (this[priv].timerRunning && this.state != this.coerceState(cmd))
        {
            winston.debug('OHItemCommandTarget:commandReceived [%s] - Clearing timer', this.name, this.meta);
            clearTimeout(this[priv].timer);
            this[priv].timerRunning = false;
            this[priv].timerMoment = null;
            this[priv].timer = null;
        }
        
        this.emit('commandReceived', cmd)
    }
    
    commandSend(command)
    {
        this[priv].pendingChange = true;
        this.emit('commandSend', this.coerceCommand(command));
    }
    
    commandSendAt(command, timeAt)
    {
        var localTimeAt = timeAt;
        winston.debug('OHItemCommandTarget:commandSendAt [%s] Sending %s at %s', this.name, command, localTimeAt.toString(), this.meta);
        
        if (!this[priv].timerRunning || localTimeAt.isAfter(this[priv].timerMoment))
        {
            if (this[priv].pendingChange)
            {
                winston.debug('OHItemCommandTarget:commandSendAt [%s] - Awaiting pending change', this.name, this.meta);
                
                var timeout = setTimeout(() => {
                    winston.warn('OHItemCommandTarget:commandSendAt [%s] - Pending change did not arrive', this.name, this.meta);
                    this._commandSendAtImpl(command, localTimeAt);
                }, 10 * 1000);
                this.once('stateChange', () =>
                {
                    winston.debug('OHItemCommandTarget:commandSendAt [%s] - Pending change arrived', this.name, this.meta);
                    clearTimeout(timeout);
                    this._commandSendAtImpl(command, localTimeAt);
                });
            }
            else
            {
                this._commandSendAtImpl(command, localTimeAt);
            }
        }
        else
        {
            winston.debug('OHItemCommandTarget:commandSendAt [%s] - Timer %s is earlier', this.name, timer[priv].timerMoment.toString(), this.meta);
        }
    }
    
    stateReceived(state)
    {
        super.stateReceived(state);
        winston.silly(this[priv].name + ' ' + typeof this + ' ' + util.inspect(this));
        
        if (!this[priv].pendingChange && this[priv].timerRunning)
        {
            clearTimeout(this[priv].timer);
            this[priv].timerRunning = false;
            this[priv].timerMoment = null;
            this[priv].timer = null;
        }
        
        this[priv].pendingChange = false;
    }
    
    turnOn()
    {
        this.commandSend(true);
    }
    
    turnOff()
    {
        this.commandSend(false);
    }
    
    get isOn()
    {
        return this.state > 0;
    }
    
    get isOff()
    {
        return this.state == 0;
    }
    
    get isTimerRunning()
    {
        return this[priv].timerRunning;
    }
}

module.exports = OHItemCommandTarget;