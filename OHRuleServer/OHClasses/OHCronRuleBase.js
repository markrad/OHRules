const util = require('util');
const winston = require('winston');
const schedule = require('node-schedule');

var priv = Symbol();

class OHCronRuleBase
{
    constructor(name, expression, hard, item, command)
    {
        super(name);
        winston.debug("OHCronRuleBase:constructor - Creating rule %s with expression %s", workname, expression);
        this[priv] = {};
        this[priv].expression = expression;
        this[priv].hard = hard;
        this[priv].item = item;
        this[priv].command = command;
    }
    
    run(items)
    {
        var that = this;
        this[priv].items = items;
        var j = schedule.scheduleJob(this[priv].expression, this.targetFunc);
    }
    
    targetFunc()
    {
        if (!this[priv].item || !this[priv].command)
        {
            winston.error("OHCronRuleBase:targetFunc - Required arguments are missing");
            throw new Error("OHCronRuleBase:targetFunc - Required arguments are missing");
        }
        
        // hard = true - always send command; hard = false - send command if no timer is running
        if (this[priv].hard || !this[priv].item.isTimerRunning)
        {
            this[priv].items[this[priv].item].commandSend(this[priv].command);
        }
    }
}

module.exports = OHRuleBase;