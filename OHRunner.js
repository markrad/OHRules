'use strict'

const ohRuleServer = require('./OHRuleServer').OHRuleServer;
const config = require('./config.json');

var server = new ohRuleServer(config);

server.start((err, itemCount, ruleCount) =>
{
    if (err)
    {
        server.logger.error("Failed to start the Rule Server");
    }
    else
    {
        server.logger.info('Rule Server started successfully');
    }
});