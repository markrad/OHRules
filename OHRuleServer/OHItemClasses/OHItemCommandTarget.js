'use strict';

const util = require('util');
const EventEmitter = require('events');
const OHItem = require('./OHItem');
const moment = require('moment');

const logger = require('log4js').getLogger();

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
        logger.debug(`OHItemCommandTarget:_commandSendAtImpl [${this.name}] - Updating timer to ${timeAt.toString()}`); 

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
                logger.debug(`OHItemCommandTarget:_awaitChanges [${this.name}] - Pending change arrived - from ${oldState.toString()} to ${newState.toString()}`); 
                clearTimeout(timeout);
                resolve(true);
            };

            if (this.pendingChange)
            {
                var timeout = setTimeout(() => {
                    logger.warn(`OHItemCommandTarget:_awaitChanges [${this.name}] - Pending change did not arrive`); 
                    this.removeListener('stateChange', _stateChangeHandler);
                    resolve(false);
                }, 10 * 1000);

                this.once('stateChange', _stateChangeHandler);
            }
            else
            {
                logger.debug(`OHItemCommandTarget:_awaitChanges [${this.name}] - No change pending`); 
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
        logger.debug(`OHItemCommandTarget:commandReceived [${this.name}] - received ${cmd}`);
/*        
        if (this.timerRunning && this.state != this.coerceState(cmd))
        {
            xxlogger.debug('OHItemCommandTarget:commandReceived [${this.name}] - Clearing timer', this.name); //, this.meta);
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
            logger.debug(`OHItemCommandTarget:commandSend [${this.name}] Sending ${command}`); 
            this.pendingChange = true;
            this.emit('commandSend', this.coerceCommand(command));
        }
        else
        {
            logger.debug(`OHItemCommandTarget:commandSend [${this.name}] Already in state ${command}`); 
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
        logger.debug(`OHItemCommandTarget:commandThisThenThat [${this.name}] cmdNow=${cmdNow};cmdNext=${cmdNext};state=${this.state}`);

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
            logger.warn(`OHItemCommandTarget:commandThisThenThat [${this.name}] Timer running for different state`);
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
            logger.debug(`OHItemCommandTarget:commandSendAt [${this.name}] Ignoring command at ${command} - already in this state`, this.name, command);
        }
        else
        {
            logger.debug(`OHItemCommandTarget:commandSendAt [${this.name}] Sending ${command} at ${localTimeAt.toString()}`); 
        
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
                logger.debug(`OHItemCommandTarget:commandSendAt [${this.name}] - Timer ${localTimeAt.toString()} is earlier than ${timer.timerMoment.toString()}`); 
            }
        }
    }
    
    stateReceived(state)
    {
        super.stateReceived(state);
        logger.trace(this.name + ' ' + typeof this + ' ' + util.inspect(this));
        
        if (this.isTimerRunning)
        {
            this.emit('timerchange', this, 'cleared', 'stateReceived');
            logger.debug(`OHItemCommandTarget:stateReceived [${this.name}] - Clearing timer`); 
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