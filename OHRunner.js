'use strict'

const ohRuleServer = require('./OHRuleServer').OHRuleServer;
const config = require('./config.json');
//const mqttLogger = require ('./OHRuleServer/winstonMqttLogger.js');
const mqttLogger2 = require ('./OHRuleServer/winstonMqttLogger2.js');

var server = new ohRuleServer(config);

server.logger.add(mqttLogger2, config.mqttLogger);

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