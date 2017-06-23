var util = require('util');
var winston = require('winston');
const mqtt = require('mqtt');
const os = require('os');
var moment = require('moment');

var MqttLogger = winston.transports.MqttLogger = function(options) {

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
    });

    this.mqttClient.on('error', (err) => 
    {
    });

    this.mqttClient.on('message', (topic, message) =>
    {
    });
};

util.inherits(MqttLogger, winston.Transport);

MqttLogger.prototype.log = function(level, msg, meta, callback) {
    //var ts = this.timestampFunction == null? moment().format() : this.timestampFunction();
    var msg = this.formatter == null
        ? this.timestampFunction() + ' ' + msg
        : this.formatter( 
            {  
                'timestamp': this.timestampFunction || null,
                'level': level,
                'message': msg,
                'meta': meta,
            });
    this.mqttClient.publish(this.topic.replace('%l', level), msg);
    callback(null, true);
}