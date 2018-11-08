"use strict";

var winston = require('winston');
var sunCalc = require('suncalc');
var moment = require('moment');
var schedule = require('node-schedule');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
const config = require('..').Config;

function astro()
{
	EventEmitter.call(this);

    var that = this;
    this.times = {};
    this.events = [
        "sunrise",
        "sunriseEnd",
        "goldenHourEnd",
        "solarNoon",
        "goldenHour",
        "sunsetStart",
        "sunset",
        "dusk",
        "nauticalDusk",
        "night",
        "nadir",
        "nightEnd",
        "nauticalDawn",
        "dawn"
    ];
    
    var lastEventSave = '';
    var lastMoonPhaseSave = '';

    var setupTimes = function(times1, times2)
    {
        winston.debug('in setupTimes');
        var now = moment();
        var latest = moment().subtract(2, 'days');
        var latestIndex = -1;

        for (var event of that.events)
        {
            that.times[event] = (moment(times1[event]).isAfter(now))?
                that.times[event] = moment(times1[event]) :
                that.times[event] = moment(times2[event]);

            winston.debug('Firing event ' + event + ' at ' + that.times[event].toString());
            setTimeout(function(myEvent)
            {
                winston.debug('Firing event ' + myEvent);
                that.emit('astroevent', myEvent);
            }, that.times[event].diff(moment()), event);
            
            winston.silly('astro - Compare %s to %s', that.times[event].toString(), latest.toString());
            if (that.times[event].isAfter(latest))
            {
                winston.silly('astro - Replaceing previous time');
                latest = that.times[event];
                latestIndex = event;
            }
        }
        
        lastEventSave = latestIndex;
        winston.debug('Last event was ' + lastEventSave);
    }

    var midnight = function()
    {
        setupTimes(
            sunCalc.getTimes(moment(), config.location.latitude, config.location.longitude),
            sunCalc.getTimes(moment().add(1, 'days'), config.location.latitude, config.location.longitude));
    }

    var updateMoon = function()
    {
        lastMoonPhaseSave = moonPhase();
        that.emit("moonPhase", lastMoonPhaseSave);
    }

    var moonPhase = function()
    {
        var moon = sunCalc.getMoonIllumination(new Date());
        winston.debug(util.inspect(moon));

        var phase = 
            moon.phase == 0.0?
            "NEW_MOON":
            moon.phase < 0.25?
            "WAXING_CRESENT":
            moon.phase == 0.25?
            "FIRST_QUARTER":
            moon.phase < 0.5?
            "WAXING_GIBBOUS":
            moon.phase == 0.5?
            "FULL_MOON":
            moon.phase < 0.75?
            "WANING_GIBBOUS":
            moon.phase == 0.75?
            "LAST_QUARTER":
            moon.phase < 1.0?
            "WANING_CRESENT":
            "FUCK_KNOWS";

        return phase;
    }
    
    this.lastEvent = function()
    {
        return lastEventSave;
    }
    
    this.lastMoonPhase = function()
    {
        return lastMoonPhaseSave;
    }

    this.isDark = function()
    {
        var temp = moment();
        var result;

        if (that.times[config.astro.daystart].isBefore(that.times[config.astro.dayend]))
        {
            result = (temp.isBetween(that.times[config.astro.daystart], that.times[config.astro.dayend]))? false : true;
        }
        else
        {
            result = (temp.isBetween(that.times[config.astro.dayend], that.times[config.astro.daystart]))? true : false;
        }

        return result;
    }

    midnight();

    schedule.scheduleJob({hour: 0, minute: 0, second: 0 }, () => midnight());

    updateMoon();
    schedule.scheduleJob({ minute: 15 }, () => updateMoon());
}

util.inherits(astro, EventEmitter);

module.exports = new astro();