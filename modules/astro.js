"use strict";

var sunCalc = require('suncalc');
var config = require('../config.json');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var moment = require('moment');
var winston = require('winston');
var schedule = require('node-schedule');

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

    var setupTimes = function(times1, times2)
    {
        var now = moment();

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
        }
    }

    var midnight = function()
    {
        setupTimes(
            sunCalc.getTimes(moment(), config.location.latitude, config.location.longitude),
            sunCalc.getTimes(moment().add(1, 'days'), config.location.latitude, config.location.longitude));
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
}

util.inherits(astro, EventEmitter);

module.exports = new astro();