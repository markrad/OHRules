const util = require('util');

const logger = require('log4js').getLogger();

class OHRuleBase
{
    constructor(name)
    {
        let workname = name || "!Name";
        logger.debug(`OHRule:constructor - Creating rule ${workname}`);
        this._name = workname;
        this._events = {};
        this._eventKey = 0;
    }
    
    run(items)
    {
        logger.error(`OHRule:run - Rule ${name} has no run function`);
    }
    
    stop()
    {
        logger.debug(`OHRule:stop - Rule ${name} is running default stop function`);
    }
    
    get name() { return this[priv].name; }
}

module.exports = OHRuleBase;