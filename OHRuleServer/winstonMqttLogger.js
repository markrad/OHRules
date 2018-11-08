var util = require('util');
var winston = require('winston');
const mqtt = require('mqtt');
const os = require('os');
var moment = require('moment');

var mqttLogger = winston.transports.CustomLogger = function(options)
{
    mqttLogger.super_.call(this, options)
    this.name = "mqttLogger";
    this.level = options.level || 'debug';
    this.host = options.host || 'mqtt://127.0.0.1';
    this.auth = options.auth || null;
    this.topic = options.topic || 'MqttLogger/%h/%l';

    this.topic = this.topic.replace('%h', os.hostname());

    this.mqttClient = mqtt.connect(this.host, this.auth);
    this.timestampFunction = options.timestamp || function() { return moment().format(); };
    this.formatter = options.formatter || null;

    this.mqttClient.on('connect', () => 
    {
        winston.info('Winston MQTT logging is enabled');
    });

    this.mqttClient.on('error', (err) => 
    {
        winston.warn('Could not connect to MQTT logging serer');
    });

    this.mqttClient.on('message', (topic, message) =>
    {
    });
};

mqttLogger.prototype.log = function(level, msg, meta, callback) 
{
    let topic =  this.topic.replace('%l', level);
    let pos = 0;
    let end = 0;
    let key = '';
    let value = '';

    while (-1 != (pos = topic.indexOf('%')))
    {
        end = topic.indexOf('/', pos);

        if (end == -1)
        {
            break;      // Not delimited - let the message show garbage
        }

        key = topic.substring(pos + 1, end);
        value = (!(key in meta))? '' : meta[key] + '/';
        topic = topic.replace('%' + key + '/', value);
    }

    this.mqttClient.publish(topic, msg);
    callback(null, true);
}

util.inherits(mqttLogger, winston.Transport);

module.exports = mqttLogger;
