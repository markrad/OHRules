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
        this.timesArray = [];
        this.events = [
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
            "dawn",
            "sunrise",
            "sunriseEnd",
            "goldenHourEnd",
        ];
        this.lastEventSave = null;
        this.lastMoonPhaseSave = '';
        this.midnight();

        schedule.scheduleJob({hour: 0, minute: 0, second: 0 }, () => this.midnight());
    
        this.updateMoon();
        schedule.scheduleJob({ minute: 15 }, () => this.updateMoon());
    }
/*
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
                logger.trace('astro - Replacing previous time');
                latest = this.times[event];
                latestIndex = event;
            }
        }
        
        this.lastEventSave = latestIndex;
        logger.debug(`Last event was ${this.lastEventSave}`);
    }
*/
    midnight()
    {
        var t1 = sunCalc.getTimes(moment().subtract(1, 'days'), config.location.latitude, config.location.longitude);
        var t2 = sunCalc.getTimes(moment(), config.location.latitude, config.location.longitude);
        var t3 = sunCalc.getTimes(moment().add(1, 'days'), config.location.latitude, config.location.longitude);

        Object.keys(t1).forEach((item, value, ar) =>
        {
            this.timesArray.push({ "event": item, "moment": moment(t1[item]) })
        });

        Object.keys(t2).forEach((item) =>
        {
            this.timesArray.push({ "event": item, "moment": moment(t2[item]) })
        });

        Object.keys(t3).forEach((item) =>
        {
            this.timesArray.push({ "event": item, "moment": moment(t3[item]) })
        });

        this.timesArray.sort((l, r) => 
        {
            return (l.moment.isAfter(r.moment))
            ? 1
            : (l.moment.isBefore(r.moment))
            ? -1
            : 0;
        });

        this.timesArray.forEach((item) => console.log(`Event=${item.event}\t\tMoment=${item.moment}`));

        var now = moment();
        var index;

        index = this.timesArray.findIndex((element) => element.moment.isAfter(now));

        console.log('');
        console.log(`Event=${this.timesArray[index - 1].event}\t\tMoment=${this.timesArray[index - 1].moment}`);
        console.log(`Event=${this.timesArray[index].event}\t\tMoment=${this.timesArray[index].moment}`);

        this.lastEventSave = this.timesArray[index - 1];
        //this.timesArray.splice(0, index);
        index = this.timesArray.findIndex((element) => element.moment.date() == now.date());
        this.timesArray.splice(0, index);
        index = this.timesArray.findIndex((element) => element.moment.date() != now.date());
        this.timesArray.splice(index);

        this.timesArray.forEach((item) =>
        {
            if (item.moment.isAfter(now))
            {
                logger.debug(`Firing event ${item.event} at ${item.moment}`);
                setTimeout((myEvent, that) =>
                {
                    logger.debug(`Firing event ${myEvent}`);
                    that.emit('astroevent', myEvent);
                    that.lastEventSave = myEvent;
                }, item.moment.diff(moment()), item, this);
            }
        });
    }
/*
    midnightx()
    {
        this.setupTimes(
            sunCalc.getTimes(moment(), config.location.latitude, config.location.longitude),
            sunCalc.getTimes(moment().add(1, 'days'), config.location.latitude, config.location.longitude));
    }
*/
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
        return this.lastEventSave.event;
    }

    lastEventTime()
    {
        return this.lastEventSave.moment;
    }

    getEvent(eventName)
    {
        var entry = this.timesArray.find((element) => element.event == eventName);

        return (!entry)? null : entry.moment;
    }
    
    lastMoonPhase()
    {
        return this.lastMoonPhaseSave;
    }

    isDark()
    {
        var index = this.events.findIndex((element) => element == this.lastEvent());
        var result = true;

        for (var i = index; i >= 0; i--)
        {
            if (this.events[i] == config.astro.daystart)
            {
                return false;
            }
            else if (this.events[i] == config.astro.dayend)
            {
                return true;
            }
        }

        return false;
/*
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
*/        
    }

    isLight()
    {
        return this.isDark() == false;
    }

}

module.exports = new Astro();