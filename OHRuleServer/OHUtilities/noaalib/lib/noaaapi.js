'use strict';

const Client = require('node-rest-client').Client;
const NoaaGrid = require('./noaagrid.js');

class Noaa {
    constructor() {

        var latitude;
        var longitude;

        if (arguments.length == 0) {
            throw new Error('ArgumentException: Missing arguments - require NoaaGrid instance or latitude, longitude and user agent string');
        }
        else if (arguments.length == 3) {
            if (typeof arguments[2] != 'string') {
                throw new Error('ArgumentException: User agent must be a string')
            }
            latitude = +arguments[0];
            longitude = +arguments[1];

            if (latitude == NaN || longitude == NaN) {
                throw new Error('ArgumentException: Arguments one and two must be valid numbers for latitude and longitude');
            }
        }
        else if (arguments.length == 1 && (typeof arguments[0] != 'object' || arguments[0].constructor.name != 'NoaaGrid')) {
            throw new Error('ArgumentException: Single argument must be NoaaGrid instance');
        }
        else if (arguments.length == 2 || arguments.length > 3) {
            throw new Error('ArgumentException: Invalid arguments - require NoaaGrid instance or longitude, latitude and user agent string');
        }

        this._noaaGrid = arguments.length == 1
            ? arguments[0]
            : new NoaaGrid(latitude, longitude, arguments[2]);
    }

    async _getData(url) {
        let args = {
            headers: { "User-Agent": this._noaaGrid.userAgent }
        }

        return new Promise((resolve, reject) => {
            let client = new Client();
    
            client.get(url, args, (data, response) => {
                if (response.statusCode != 200) {
                    reject(new Error(response.statusMessage));
                }
                else {
                    let jsondata = JSON.parse(data);
                    let result = { properties: jsondata.properties };
                    resolve(result);
                }
            });
        });
    }

    async getForecastAll() {
        return this._getData((await this._noaaGrid.retrieveGrids()).forecast);
    }

    async getForecastHourlyAll() {
        return this._getData((await this._noaaGrid.retrieveGrids()).forecastHourly);
    }

    async getForecast() {
        let jsonData = await this.getForecastAll();
        
        return { periods: jsonData.properties.periods, updateTime: jsonData.properties.updateTime };
    }

    async getForecastHourly() {
        let jsonData = await this.getForecastHourlyAll();
        
        return { periods: jsonData.properties.periods, updateTime: jsonData.properties.updateTime };
    }
}

module.exports = Noaa;