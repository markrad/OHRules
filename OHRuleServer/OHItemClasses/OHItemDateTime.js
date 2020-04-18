'use strict';

const util = require('util');
const EventEmitter = require('events');
const moment = require('moment');
const OHItem = require('./OHItem');

const logger = require('log4js').getLogger();

class OHItemDateTime extends OHItem
{
    constructor(jsonObj)
    {
        super(jsonObj);
    }

    coerceCommand(command)
    {
        let cmd = command;

        if (typeof cmd != 'object' || !cmd.constructor || cmd.constructor.name != 'Moment')
        {
            cmd = moment(cmd);
        }

        // The argument command is expected to be a moment
        logger.debug(`OHItemDateTime:coerceCommand [${this.name}] - state coerced`);
        return cmd.toISOString(true);
    }
    
    coerceState(state)
    {
        logger.debug(`OHItemDateTime:coerceState: [${this.name}] coercing ${state}`);
        return (state == "NULL")? moment() : moment(new Date(state));
    }
}

module.exports = OHItemDateTime;