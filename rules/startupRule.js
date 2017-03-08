"use strict";

var winston = require('winston');
var astro = require('../modules/astro');
var ohItems = require('../ohItem').ohItems;
var config = require('../config');

var startupRule = function()
{
    var that = this;
    this.name = "startupRule";
    var items;

    this.init = function(itemsIn)
    {
        items = itemsIn;

        astro.on('astroevent', (myEvent) => {
            winston.debug('Event ' + myEvent + ' has occured');
            items.LastAstroEvent.commandSend(myEvent);

            if (myEvent == config.astro.daystart)
            {
                items.Daylight.stateSet(true);
                items.Malibu_Lights.commandSend(false);
            }
            else if (myEvent == config.astro.dayend)
            {
                items.Daylight.stateSet(false);
                items.Malibu_Lights.commandSend(true);
            }
        });

        items.Daylight.stateSet(!astro.isDark());
    }
};

module.exports = new startupRule();