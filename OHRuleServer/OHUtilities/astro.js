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
        var d1 = moment().set({ 'h': 12, 'm': 0, 's': 0, 'ms': 0 });
        var d2 = d1.add(1, 'd');
        var moon1 = sunCalc.getMoonIllumination(d1);
        var moon2 = sunCalc.getMoonIllumination(d2);
        var phase = 'Not Set';

        if (moon1.phase > moon2.phase)
        {
            phase = 'New Moon';
        }
        else if (moon1.phase < 0.25 && moon2.phase > 0.25)
        {
            phase = 'First Quarter';
        }
        else if (moon1.phase < 0.5 && moon2.phase > 0.5)
        {
            phase = 'Full Moon';
        }
        else if (moon1.phase < 0.75 && moon2.phase > 0.75)
        {
            phase = 'Last Quarter';
        }
        else if (moon1.phase < 0.25)
        {
            phase = 'Waxing Cresent'
        }
        else if (moon1.phase < 0.5)
        {
            phase = 'Waxing Gibbous'
        }
        else if (moon1.phase < 0.75)
        {
            phase = 'Waning Gibbous'
        }
        else if (moon1.phase < 1.0)
        {
            phase = 'Waning Cresent'
        }
        else
        {
            phase = 'Fuck Knows'
        }

        winston.debug('astro - Moon Phase = %s', phase);
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

    this.isLight = function()
    {
        return this.isDark == false;
    }

    midnight();

    schedule.scheduleJob({hour: 0, minute: 0, second: 0 }, () => midnight());

    updateMoon();
    schedule.scheduleJob({ minute: 15 }, () => updateMoon());
}

util.inherits(astro, EventEmitter);

module.exports = new astro();