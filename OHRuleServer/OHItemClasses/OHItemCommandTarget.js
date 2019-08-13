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
            this.emit('timerchange', this, 'cleared', 'overridden');
        }

        this.timerMoment = timeAt;
        this.timerRunning = true;
        this.emit('timerchange', this, 'set', this.timerMoment);
        this.timer = setTimeout(() =>
        {
            this.emit('timerchange', this, 'triggered', command);
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
    
    commandThisThenThat(commandNow, commandNext, timeAt)
    {
        // Should we run:
        // a) if there is no timer running
        //    i) if the device is in the required state then NO
        // b) if there is a timer running
        //    i) if the new timer is not later than the old timer then NO
        // c) yes RUN

        var cmdNow = this.coerceState(commandNow);
        var cmdNext = this.coerceState(commandNext);
        winston.debug(`OHItemCommandTarget:commandThisThenThat: cmdNow=${cmdNow};cmdNext=${cmdNext};state=${this.state}`);

        if (this.isTimerRunning == false)
        {
            this.emit('timerchange', this, 'info', 'Timer is not running');

            if (this.state == cmdNow)
            {
                this.emit('timerchange', this, 'info', 'Device is already in required state');
                return false;
            }
        }
        else if (this.state != cmdNow)
        {
            winston.warn("OHItemCommandTarget:commandThisThenThat: Timer running for different state");
            this.emit('timerchange', this, 'warn', 'Timer running for different state');
            return false;
        }
        else
        {
            this.emit('timerchange', this, 'info', 'Timer is running');

            if (timeAt.isAfter(this.timerMoment) == false)
            {
                this.emit('timerchange', this, 'info', 'Current timer is later than requested');
                return false;
            }
        }

        this.emit('timerchange', this, 'info', 'Passed');

        this.commandSend(cmdNow);
        this._awaitChanges().then(() =>
        {
            this._commandSendAtImpl(cmdNext, timeAt);
        });

        return true;
    }

    commandSendAt(command, timeAt)
    {
        var localTimeAt = timeAt;

        if (command == this.state)
        {
            winston.debug('OHItemCommandTarget:commandSendAt [%s] Ignoring command at %s - already in this state', this.name, command, localTimeAt.toString());
        }
        else
        {
            winston.debug('OHItemCommandTarget:commandSendAt [%s] Sending %s at %s', this.name, command, localTimeAt.toString()); 
        
            if (!this.isTimerRunning || localTimeAt.isAfter(this.timerMoment))
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
    }
    
    stateReceived(state)
    {
        super.stateReceived(state);
        winston.silly(this.name + ' ' + typeof this + ' ' + util.inspect(this));
        
        if (this.isTimerRunning)
        {
            this.emit('timerchange', this, 'cleared', 'stateReceived');
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