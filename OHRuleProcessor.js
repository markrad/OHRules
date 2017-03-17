'use strict'

const util = require('util');
var http = require('http');
const mqtt = require('mqtt');
const path = require('path');
var walk = require('walk');
var ohItemFactory = require('./ohItem').ohItemFactory;
var ohItems = require('./ohItem').ohItems;
var config = require('./config.json');
var winston = require('winston');
var moment = require('moment');

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, { 'timestamp': true, 'colorize': true, 'timestamp' : function()
	{
		return moment().format();
	} 
});
winston.level = 'debug';

var hostPath = '/rest/items'
var jsonDirective = (config.openhab.version) == 1? '?type=json' : '';
const topicCommand = 'openhab/external/';
const topicState = 'openhab/slave/slaveGarage/';

function getItems(url, callback)
{
	let ohUrl = 'http://' + url + hostPath + jsonDirective;
	winston.info('OpenHab web server = ' + ohUrl);
	http.get(ohUrl, function(response)
	{
		let rawData = '';
		
		response.on('data', (chunk) => rawData += chunk);
		response.on('end', () => 
		{
			var parsedData = "nothing";

			try
			{
				parsedData = JSON.parse(rawData);

				ohItemFactory.getItems(parsedData, function(err)
				{
					if (err)
					{
						callback(err);
					}
					else
					{
						for (var item of Object.keys(ohItems))
						{
							ohItems[item]
							.on('commandSend', (name, command) =>
							{
								winston.info('<' + topicCommand + name + '/command' + ' ' + command);
								mqttClient.publish(topicCommand + name + '/command', command.toString());
							})
							.on('stateSet', (name, requestedState) =>
							{
								winston.info('<' + topicState + name + '/state' + ' ' + requestedState);
								mqttClient.publish(topicState + name + '/state', requestedState);
							});
						}

						callback(null);
					}
				});
			}
			catch (e)
			{
				winston.warn(e.message);
				winston.debug(util.inspect(parsedData));
				callback(e);
			}
		});
		response.on('error', (err) => { winston.error("Error Occurred: " + err.message); callback(err); });
	});
}

function findRules(done)
{
	var rulesFolder = config.rulesFolder || 'rules';
	
	var rulesDir = path.isAbsolute(config.rulesFolder)?
		config.rulesFolder :
		path.dirname(process.argv[1]) + path.sep + config.rulesFolder;

	winston.info('Rules directory = ' + rulesDir);

    var walker  = walk.walk(rulesDir, { followLinks: false });
	var modules = [];

    walker.on('file', function(root, stat, next) 
	{
		if (stat.type === 'file')
		{
			var current = path.join(root, stat.name).replace(/\\/g, '/');		// Windows path delimiters do not work for require
			var extname = path.extname(current);
			winston.debug(current);

			if (extname === '.js')
			{
				var module = require(current);

				if (module)
				{
					if (Array.isArray(module))
					{
						modules = modules.concat(module);
					}
					else
					{
						modules.push(module);
					}
				}
			}
		}

        next();
    });

    walker.on('end', function() 
	{
        done(modules);
    });
}

getItems(config.openhab.webserver, function(err) 
{
	if (err)
	{
		process.exit(4);
	}

	findRules(function(modules)
	{
		for (var m of modules)
		{
			var name = (m.name != undefined)? m.name : 'Anonymous';
			winston.info('Initializing rule ' + name);

			try
			{
				m.init(ohItems);
			}
			catch (exp)
			{
				winston.error('Rule ' + name + ' threw exception ' + exp);
				winston.error(exp.stack);
			}
		}
	});

});

winston.info('MQTT server = ' + config.mqtt.host);
const mqttClient = mqtt.connect(config.mqtt.host, config.mqtt.auth);

mqttClient.on('connect', () => 
{
	winston.info('MQTT connected');
	mqttClient.subscribe('openhab/master/#');
	winston.info('Subscribed to MQTT topic')
});

mqttClient.on('error', (err) => 
{
	winston.error(err);
});

mqttClient.on('message', (topic, message) =>
{
	if (topic.indexOf('Temp') == -1 && 
		topic.indexOf('Humidity') == -1 && 
		topic.indexOf('Sensor') == - 1 &&
		topic.indexOf('CO2') == -1 &&
		topic.indexOf('Thermostat') == -1 &&
		topic.indexOf('Noise') == -1 &&
		topic.indexOf('Pressure') == -1
		)
	{
		winston.info('>topic=' + topic + '; message=' + message);
	}

	let parts = topic.toString().split('/');
	let item = parts[parts.length - 2];
	let verb = parts[parts.length - 1];
	
	if (ohItems[item] != undefined)
	{
		if (verb === 'state')
		{
			ohItems[item].state = message;
		}
		else if (verb === 'command')
		{
			ohItems[item].commandReceived(message);
		}
	}
});

process.on('SIGINT', () =>
{
	winston.info('Closing down');
	mqttClient.end();
	process.exit();
});