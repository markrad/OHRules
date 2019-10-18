"use strict";

var sunCalc = require('suncalc');
var moment = require('moment');
var schedule = require('node-schedule');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
const config = require('..').Config;

const logger = require('log4js').getLogger();

class Astro extends EventEmitter
{
    constructor()
    {
        super();
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
        this.lastEventSave = '';
        this.lastMoonPhaseSave = '';
        this.midnight();

        schedule.scheduleJob({hour: 0, minute: 0, second: 0 }, () => this.midnight());
    
        this.updateMoon();
        schedule.scheduleJob({ minute: 15 }, () => this.updateMoon());
    }

    setupTimes(times1, times2)
    {
        logger.debug('in setupTimes');
        var now = moment();
        var latest = moment().subtract(2, 'days');
        var latestIndex = -1;

        for (var event of this.events)
        {
            this.times[event] = (moment(times1[event]).isAfter(now))?
                this.times[event] = moment(times1[event]) :
                this.times[event] = moment(times2[event]);

            logger.debug(`Firing event ${event} at ${this.times[event].toString()}`);
            setTimeout((myEvent, that) =>
            {
                logger.debug(`Firing event ${myEvent}`);
                that.emit('astroevent', myEvent);
            }, this.times[event].diff(moment()), event, this);
            
            logger.trace(`astro - Compare ${this.times[event].toString()} to ${latest.toString()}`);
            if (this.times[event].isAfter(latest))
            {
                logger.trace('astro - Replaceing previous time');
                latest = this.times[event];
                latestIndex = event;
            }
        }
        
        this.lastEventSave = latestIndex;
        logger.debug(`Last event was ${this.lastEventSave}`);
    }

    midnight()
    {
        this.setupTimes(
            sunCalc.getTimes(moment(), config.location.latitude, config.location.longitude),
            sunCalc.getTimes(moment().add(1, 'days'), config.location.latitude, config.location.longitude));
    }

    updateMoon()
    {
        this.lastMoonPhaseSave = this.moonPhase();
        this.emit("moonPhase", this.lastMoonPhaseSave);
    }

    moonPhase()
    {
        var d1 = moment().set({ 'h': 12, 'm': 0, 's': 0, 'ms': 0 });
        var d2 = moment().set({ 'h': 12, 'm': 0, 's': 0, 'ms': 0 }).add(1, 'd');
        var moon1 = sunCalc.getMoonIllumination(d1);
        var moon2 = sunCalc.getMoonIllumination(d2);
        var phase = 'Not Set';

        logger.debug(`d1=${d1.format()};d2=${d2.format()};moon1.phase=${moon1.phase};moon2.phase=${moon2.phase}`);

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

        logger.debug(`astro - Moon Phase = ${phase}`);
        return phase;
    }
    
    lastEvent()
    {
        return this.lastEventSave;
    }

    getEvent(eventName)
    {
        if (this.times.hasOwnProperty(eventName))
            return this.times[eventName].format();
        else
            return "0";
    }
    
    lastMoonPhase()
    {
        return this.lastMoonPhaseSave;
    }

    isDark()
    {
        var temp = moment();
        var result;

        if (this.times[config.astro.daystart].isBefore(this.times[config.astro.dayend]))
        {
            result = (temp.isBetween(this.times[config.astro.daystart], this.times[config.astro.dayend]))? false : true;
        }
        else
        {
            result = (temp.isBetween(this.times[config.astro.dayend], this.times[config.astro.daystart]))? true : false;
        }

        return result;
    }

    isLight()
    {
        return this.isDark() == false;
    }

}

module.exports = new Astro();