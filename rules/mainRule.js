"use strict";

var ohItems = require('../ohItem').ohItems;
var schedule = require('node-schedule');
var astro = require('../modules/astro');
var config = require('../config');

var winston = require('winston');

var cancelTimerAtOffRule = function(target)
{
    this.name = "cancelTimerAtOffRule: " + target.name;
    this.init = function()
    {
        target.on('state', function(name, oldState, newState) 
        {
            if (!target.coerceState(newState))
            {
                target.cancelTimer();
            }
        });
    }
}

var outdoorLightsOffRule = function()
{
    this.name = "outdoorLightsOffRule";
    this.init = function()
    {
        var job = schedule.scheduleJob( { minute: 00 }, function()
        {
            if (!ohItems.isDark)
            {
                ohItems.Outdoor_Lights.TurnOff();
            }
        });
    }
}

var switchOffAt = function(target, whenAt)
{
    this.name = "switchOffAt: " + target.name;
    this.init = function()
    {
        schedule.scheduleJob(whenAt, () => target.commandSend(false));
    };
}

var personHome = function(target)
{
	const OFFDELAY = config.personHome.OFFDELAY; //{ minutes: 10 };

    this.name = "personHome: " + target.name;
    this.init = function()
    {
        if (astro.isDark())
        {
            ohItems.Outdoor_Lights.commandSendWithTimeoutIn(true, OFFDELAY, false);
        }
    }
}

var garageMotionDetected = function()
{
	const OFFDELAY = config.garageMotionDetected.OFFDELAY;

    this.name = "garageMotionDetected";

    this.init = function()
    {
        ohItems.GarageMotion_Sensor.on('state', function(target, oldState, newState)
        {
            if (astro.isDark())
            {
                if (newState)
                {
                    winston.debug("Motion detected");
                    ohItems.GarageMain_Lights.commandSendWithTimeoutIn(true, OFFDELAY, false);
                }
            }
        });
    };
};

var garageDoorStateChange = function()
{
    const MAINOFFDELAY = config.garageDoorStateChange.MAINOFFDELAY;
    const ENTRYOFFDELAY = config.garageDoorStateChange.ENTRYOFFDELAY;
    const FOYEROFFDELAY = config.garageDoorStateChange.FOYEROFFDELAY;

    this.name = "garageDoorStateChange";
    this.init = function()
    {
        ohItems.GarageMain_DoorState.on('state', function(target, oldState, newState)
        {
            winston.debug("Garage door state is now " + newState.toString());

            if (astro.isDark())
            {
                if (newState)
                {
                    ohItems.Front_Foyer.commandSendWithTimeoutIn(true, FOYEROFFDELAY, false);
                }
                else
                {
                    ohItems.GarageMain_Lights.commandSendWithTimeoutIn(true, MAINOFFDELAY, false);
                    ohItems.GarageEntry_Lights.commandSendWithTimeoutIn(true, ENTRYOFFDELAY, false);
                    ohItems.Outdoor_Lights.commandSendWithTimeoutIn(true, MAINOFFDELAY, false);
                }
            }
        });
    };
};

var rules = [];

rules.push(new garageMotionDetected());
rules.push(new garageDoorStateChange());
rules.push(new switchOffAt(ohItems.Outdoor_Lights, { hour: 2, minute: 0, second: 0}));
rules.push(new switchOffAt(ohItems.Malibu_Lights, { hour: 2, minute: 0, second: 0}));

for (var childKey in ohItems.G_Phones.children)
{
    rules.push(new personHome(ohItems.G_Phones.children[childKey]));
}

/*for (var childKey in ohItems.Lights.children)
{
    rules.push(new cancelTimerAtOffRule(ohItems.Lights.children[childKey]));
}
*/
module.exports = rules;