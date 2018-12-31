'use strict';

const OHRuleBase = require('../OHRuleServer').OHRuleBase;
var astro = require('../OHRuleServer').OHUtility.astro;
var schedule = require('node-schedule');
var moment = require('moment');

var priv = Symbol();
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
            winston.debug('startupRule:run - Event %s has occured', myEvent);
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
        
        astro.on('moonPhase', (phase) => ohRuleServer.items.Moon_Phase.state = phase);

        ohRuleServer.items.Daylight.state = !astro.isDark();
        ohRuleServer.items.LastAstroEvent.state = astro.lastEvent();
        ohRuleServer.items.Moon_Phase.state = astro.lastMoonPhase();
        
        winston.debug('startupRule:run - astro.isDark()=%s;moment().hour()=%s', astro.isDark(), moment().hour());
        
        if (astro.isDark() && (moment().hour() < 3 || moment().hour() > 12))
        {
            ohRuleServer.items.Malibu_Lights.turnOn();
        }
        else if (!astro.isDark && ohRuleServer.items.Malibu_Lights.isOn)
        {
            ohRuleServer.items.Malibu_Lights.turnOff()
        }
        
        if (!astro.isDark && ohRuleServer.items.Outdoor_Lights.isOn)
        {
            ohRuleServer.items.Outdoor_Lights.turnOff();
        }
        
        winston.debug('startupRule:run - Starting job to turn off outdoor lights');
        
        var rule = new schedule.RecurrenceRule();
        rule.minute = 7;
        
        schedule.scheduleJob(rule, () =>
        {
            winston.debug('startupRule:run - Checking outdoor lights isDark=%s;Outdoor_Lights=%s', astro.isLight(), ohRuleServer.items.Outdoor_Lights.isOn);
            if (astro.isLight() && ohRuleServer.items.Outdoor_Lights.isOn)
            {
                ohRuleServer.items.Outdoor_Lights.turnOff();
            }
        });
    }
};

module.exports = new startupRule();