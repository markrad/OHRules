const util = require('util');
const mqtt = require('mqtt');
const os = require('os');
const moment = require('moment');

const DEFAULT_HOST = 'mqtt://127.0.0.1';
const DEFAULT_TOPIC = 'MqttLogger/%h/%l';
const DEFAULT_AUTH = null;

var topic = '';
var mqttClient = null;

function attemptConnection(options)
{
    let host = options.host || DEFAULT_HOST;
    let auth = options.auth || DEFAULT_AUTH;
    topic = options.topic || DEFAULT_TOPIC;
    topic = topic.replace('%h', os.hostname());

    mqttClient = mqtt.connect(host, auth);
        
    mqttClient.on('connect', () => 
    {
        console.log('MQTT logging is enabled');
    });

    mqttClient.on('offline', () => 
    {
        console.log('MQTT logging server went offline');
        mqttClient.reconnect();
    });

    mqttClient.on('error', (err) => 
    {
        console.log('Could not connect to MQTT logging serer');
    });

    mqttClient.on('message', (topic, message) =>
    {
    });
}

function mqttAppender(layout, timezoneOffset)
{
    return (loggingEvent) =>
    {
        loggingEvent.level.levelStr;

        if (mqttClient && mqttClient.connected)
        {
            let thisTopic = topic.replace('%l', loggingEvent.level.levelStr);
            mqttClient.publish(thisTopic, `[${moment().format()}] [${loggingEvent.level.levelStr}] ${loggingEvent.data.join(' ')}`, null, (err) => 
            {
                if (err)
                {
                    console.log(`Failed to publish mesage: ${err.message}`);
                }
            });
        }
    };
}

function configure(config, layouts)
{
    let layout = config.layout? layouts.layout(config.loyout.type, config.layout) : layouts.basicLayout;

    attemptConnection(config);

    return mqttAppender(layout, config.timezoneOffset);
}

function end()
{
    if (mqttClient && mqttClient.connected)
    {
        mqttClient.end();
    }
}

exports.configure = configure;
exports.end = end;