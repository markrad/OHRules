'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events');
const OHItem = require('./OHItem');
const moment = require('moment');

class OHItemCommandTarget extends OHItem
{
    constructor(jsonObj)
    {
        super(jsonObj);
        this.pendingChange = false;
        this.timerRunning = false;
        this.timerMoment = null;
        this.timer = null;
    }
    
    _commandSendAtImpl(command, timeAt)
    {
        winston.debug('OHItemCommandTarget:_commandSendAtImpl [%s] - Updating timer to %s', this.name, timeAt.toString()); 

        if (this.isTimerRunning)
        {
            clearTimeout(this.timer);
        }

        this.timerMoment = timeAt;
        this.timerRunning = true;
        this.timer = setTimeout(() =>
        {
            this.commandSend(command);
            this.timerRunning = false;
            this.timerMoment = null;
            this.timer = null;
        }, timeAt.diff(moment()));
    }
/*
    _stateChangeHandler(handler, oldState, newState)
    {
        handler(oldState, newState);
    }
*/
    _awaitChanges()
    {
        return new Promise((resolve, reject) =>
        {
            var _stateChangeHandler = function(oldState, newState) 
            {
                winston.debug('OHItemCommandTarget:_awaitChanges [%s] - Pending change arrived - from %s to %s', this.name, oldState.toString(), newState.toString()); 
                clearTimeout(timeout);
                resolve(true);
            };

            if (this.pendingChange)
            {
                var timeout = setTimeout(() => {
                    winston.warn('OHItemCommandTarget:_awaitChanges [%s] - Pending change did not arrive', this.name); 
                    this.removeListener('stateChange', _stateChangeHandler);
                    resolve(false);
                }, 10 * 1000);

                this.once('stateChange', _stateChangeHandler);
            }
            else
            {
                winston.debug('OHItemCommandTarget:_awaitChanges [%s] - No change pending', this.name); 
                resolve(true);
            }
        });
    }
    
    coerceCommand(command)
    {
        return command;
    }
    
    commandReceived(cmd)
    {
        winston.debug('OHItemCommandTarget:commandReceived [%s] - received %s', this.name, cmd); //, this.meta);
/*        
        if (this.timerRunning && this.state != this.coerceState(cmd))
        {
            winston.debug('OHItemCommandTarget:commandReceived [%s] - Clearing timer', this.name); //, this.meta);
            clearTimeout(this.timer);
            this.timerRunning = false;
            this.timerMoment = null;
            this.timer = null;
        }
*/        
        this.pendingChange = true;
        this.emit('commandReceived', cmd);
        //this._awaitChanges();
    }
    
    commandSend(command)
    {
        if (Boolean(command) != Boolean(this.state))
        {
            winston.debug('OHItemCommandTarget:commandSend [%s] Sending %s', this.name, command); 
            this.pendingChange = true;
            this.emit('commandSend', this.coerceCommand(command));
        }
        else
        {
            winston.debug('OHItemCommandTarget:commandSend [%s] Already in state %s', this.name, command); 
        }
    }
    
    commandSendAt(command, timeAt)
    {
        var localTimeAt = timeAt;
        winston.debug('OHItemCommandTarget:commandSendAt [%s] Sending %s at %s', this.name, command, localTimeAt.toString()); 
        
        if (!this.timerRunning || localTimeAt.isAfter(this.timerMoment))
        {
            this._awaitChanges()
                .then(() => 
                {
                    this._commandSendAtImpl(command, localTimeAt);
                });
        }
        else
        {
            winston.debug('OHItemCommandTarget:commandSendAt [%s] - Timer %s is earlier than %s', this.name, localTimeAt.toString(), timer.timerMoment.toString()); 
        }
    }
    
    stateReceived(state)
    {
        super.stateReceived(state);
        winston.silly(this.name + ' ' + typeof this + ' ' + util.inspect(this));
        
        if (this.isTimerRunning)
        {
            winston.debug('OHItemCommandTarget:stateReceived [%s] - Clearing timer', this.name); 
            clearTimeout(this.timer);
            this.timerRunning = false;
            this.timerMoment = null;
            this.timer = null;
        }
        
        this.pendingChange = false;
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
        return this.timerRunning;
    }
}

module.exports = OHItemCommandTarget;