'use strict';

const OHRuleBase = require('../OHRuleServer').OHRuleBase;
var astro = require('../OHRuleServer').OHUtility.astro;
const once = require('bella-scheduler').once;
const every = require('bella-scheduler').every;
const daily = require('bella-scheduler').daily;
  
var moment = require('moment');

var winston = null;

class startupRule extends OHRuleBase
{
    constructor()
    {
        super("startupRule");
    }
    
    run(ohRuleServer)
    {
        winston = ohRuleServer.logger;
        astro.on('astroevent', (myEvent) => 
        {
            winston.debug(`startupRule:run - Event ${myEvent} has occured`);
            ohRuleServer.items.LastAstroEvent.state = myEvent;
            
            if (myEvent == ohRuleServer.config.astro.daystart)
            {
                ohRuleServer.items.Daylight.turnOn();
                ohRuleServer.items.Malibu_Lights.turnOff();
                ohRuleServer.items.Outdoor_Lights.turnOff();
            }
            else if (myEvent == ohRuleServer.config.astro.dayend)
            {
                ohRuleServer.items.Daylight.turnOff();
                ohRuleServer.items.Malibu_Lights.turnOn();
            }
        });

        Object.keys(ohRuleServer.items).forEach((key) =>
        {
            ohRuleServer.items[key].on('timerchange', (item, action, reason) =>
            {
                if (action != "set")
                {
                    winston.debug(`Timerchange: Item=${item.name};action=${action};reason=${reason}`);
                }
                else
                {
                    winston.debug(`Timerchange: Item=${item.name};action=${action};time=${reason.toString()}`);
                }
            });
        });
        
        astro.on('moonPhase', (phase) => ohRuleServer.items.Moon_Phase.state = phase);

        ohRuleServer.items.Daylight.state = !astro.isDark();
        ohRuleServer.items.LastAstroEvent.state = astro.lastEvent();
        ohRuleServer.items.Moon_Phase.state = astro.lastMoonPhase();
        ohRuleServer.items.Sunrise.state = astro.getEvent("sunrise");
        ohRuleServer.items.Sunset.state = astro.getEvent("sunset");
        
        winston.debug(`startupRule:run - astro.isDark()=${astro.isDark()};moment().hour()=${moment().hour()}`);
        
        if (astro.isDark() && (moment().hour() < 3 || moment().hour() > 12))
        {
            ohRuleServer.items.Malibu_Lights.turnOn();
        }
        // else if (astro.isLight && ohRuleServer.items.Malibu_Lights.isOn)
        // {
        //     ohRuleServer.items.Malibu_Lights.turnOff();
        // }
        
        // if (astro.isLight && ohRuleServer.items.Outdoor_Lights.isOn)
        // {
        //     ohRuleServer.items.Outdoor_Lights.turnOff();
        // }
        
        winston.debug('startupRule:run - Starting job to turn off outdoor lights');
        
        every('15m', () =>
        {
            winston.debug(`startupRule:run - Checking outdoor lights isLight=${astro.isLight()};Outdoor_Lights=${ohRuleServer.items.Outdoor_Lights.isOn};Malibu_Lights=${ohRuleServer.items.Malibu_Lights.isOn}`);
            if (astro.isLight())
            { 
                if (ohRuleServer.items.Outdoor_Lights.isOn)
                {
                    ohRuleServer.items.Outdoor_Lights.turnOff();
                }

                if (ohRuleServer.items.Malibu_Lights.isOn)
                {
                    ohRuleServer.items.Malibu_Lights.turnOff();
                }
            }
        });

        // Update sunrise and sunset times just after midnight each day
        daily('00:01', () =>
        {
            ohRuleServer.items.Sunrise.state = astro.getEvent("sunrise");
            ohRuleServer.items.Sunset.state = astro.getEvent("sunset");
        });

        // Turn off the malibu lights every night at 3:00
        daily('3:00', () =>
        {
            winston.debug('startupRule:run - Turning off Malibu Lights at 3:00');
            ohRuleServer.items.Malibu_Lights.turnOff();
            ohRuleServer.items.Outdoor_Lights.turnOff();
        });
    }
};

module.exports = new startupRule();