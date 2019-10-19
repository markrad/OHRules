'use strict';

const util = require('util');
const EventEmitter = require('events');
const OHItem = require('./OHItem');

const logger = require('log4js').getLogger();

class OHItemLocation extends OHItem
{
    constructor(jsonObj)
    {
        super(jsonObj);
    }

    get latitude() { return this._state.split(',')[0]; }
    get longitude() { return this._state.split(',')[1]; }
    get state() { return super.state; }
    
    coerceState(state)
    {
        try
        {
            return state.toString().split(',').slice(0, 2).join(',');
        }
        catch (exp)
        {
            logger.error(`OHItemLocation:coerceState [${this.name}] - invalid state: ${state} : ${exp.message}`);
            logger.debug(exp.stack);
            return undefined;
        }
    }

    set state(value)
    {
        var vals = value.split(',');

        if (vals != 2 || Nan == parseFloat(vals[0] || NaN == parseFloat(vals[1])))
        {
            logger.error(`OHItemLocation:set state [${this.name}] - invalid value: ${this.coerceCommand(value)}`);
        }
        else
        {
            super.state(value);
        }
    }

    set latitude(value)
    {
        logger.debug(`OHItemLocation:set latitude [${this.name}] - received ${this.coerceCommand(value)}`);

        if (Nan == parseFloat(value))
        {
            logger.error(`OHItemLocation:set latitude [${this.name}] - invalid value: ${this.coerceCommand(value)}`);
        }
        else
        {
            super.state = `${value.toString()},${this.longitude}`;
        }
    }

    set longitude(value)
    {
        logger.debug(`OHItemLocation:set longitude [${this.name}] - received ${this.coerceCommand(value)}`);

        if (Nan == parseFloat(value))
        {
            logger.error(`OHItemLocation:set longitude [${this.name}] - invalid value: ${this.coerceCommand(value)}`);
        }
        else
        {
            super.state = `${this.latitude},${value.toString()}`;
        }
    }
}

module.exports = OHItemLocation;
