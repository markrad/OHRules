'use strict'

var Client = require('node-rest-client').Client;

const GRIDURL = 'https://api.weather.gov/points/';

class NoaaGrid {
    constructor() {
        if (arguments.length != 3) {
            throw new Error('ArgumentException: NoaaGrid requires two parameters - longitude, latitude, and user agent <myapp/email>');
        }
        else if (typeof arguments[0] != 'number' || typeof arguments[1] != 'number') {
            throw new Error('ArgumentException: NoaaGrid longitude and latitude must be numeric');
        }
        else if (typeof arguments[2] != 'string') {
            throw new Error('ArgumentException: NoaaGrid user agent must be a string');
        }

        this._longitude = arguments[0];
        this._latitude = arguments[1];
        this._userAgent = arguments[2];
        this._grids = { 
            x: null, 
            y: null, 
            cwa: null,
            city: null,
            state: null,
            forecast: null,
            forecastHourly: null,
            observationStations: null
        };
    }

    get userAgent() {
        return this._userAgent;
    }

    async retrieveGrids() {
        let url = GRIDURL + this._longitude + ',' + this._latitude;
        let args = {
            headers: { "User-Agent": this.userAgent }
        }

        return new Promise((resolve, reject) => {
            if (this._grids.x != null) {
                resolve(this._grids);
            }
            else {
                let client = new Client();

                client.get(url, args, (data, response) => {
                    if (response.statusCode != 200) {
                        reject(new Error(response.statusMessage));
                    }
                    else {
                        var jsonData = JSON.parse(data);
                        
                        this._grids.x = jsonData.properties.gridX;
                        this._grids.y = jsonData.properties.gridY;
                        this._grids.cwa = jsonData.properties.cwa;
                        this._grids.city = jsonData.properties.relativeLocation.properties.city;
                        this._grids.state = jsonData.properties.relativeLocation.properties.state;
                        this._grids.forecast = jsonData.properties.forecast;
                        this._grids.forecastHourly = jsonData.properties.forecastHourly;
                        this._grids.observationStations = jsonData.properties.observationStations;
                        resolve(this._grids);
                    }
                });
            }
        });
    }
}

module.exports = NoaaGrid;