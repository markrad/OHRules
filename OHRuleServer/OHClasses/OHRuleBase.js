const util = require('util');
const winston = require('winston');

var priv = Symbol();

class OHRuleBase
{
    constructor(name)
    {
        let workname = name || "!Name";
        winston.debug("OHRule:constructor - Creating rule %s", workname);
        this[priv] = {};
        this[priv].name = workname;
        this[priv].events = {};
        this[priv].eventKey = 0;
    }
    
    run(items)
    {
        winston.error("OHRule:run - Rule %s has no run function", name);
    }
    
    stop()
    {
        winston.debug("OHRule:stop - Rule %s is running default stop function", name);
    }
    
    get name() { return this[priv].name; }
}

module.exports = OHRuleBase;