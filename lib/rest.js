const request = require('request');
const qs = require('querystring');
const _ = require('underscore');
const crypto = require('crypto');
const Beautifier = require('./beautifier.js');
const assert = require('assert');

class BinanceRest {

    constructor({ key, secret, recvWindow, timeout = 15000, disableBeautification }) {
        this.key = key;
        this.secret = secret;
        this.recvWindow = recvWindow;
        this.timeout = timeout;
        this.disableBeautification = disableBeautification;

        this._beautifier = new Beautifier();
        this._baseUrl = 'https://api.binance.com/';
    }

    _makeRequest(query, callback, route, security, method) {
        assert(_.isUndefined(callback) || _.isFunction(callback), 'callback must be a function or undefined');
        assert(_.isObject(query), 'query must be an object');

        let queryString;
        const type = _.last(route.split('/')),
            options = {
                url: `${this._baseUrl}${route}`,
                timeout: this.timeout
            };

        if (security === 'SIGNED') {
            if (this.recvWindow) {
                query.recvWindow = this.recvWindow;
            }
            queryString = qs.stringify(query);
            options.url += '?' + queryString;
            if (options.url.substr(options.url.length - 1) !== '?') {
                options.url += '&';
            }
            options.url += `signature=${this._sign(queryString)}`;
        } else {
            queryString = qs.stringify(query);
            if (queryString) {
                options.url += '?' + queryString;
            }
        }
        if (security === 'API-KEY' || security === 'SIGNED') {
            options.headers = { 'X-MBX-APIKEY': this.key };
        }
        if (method) {
            options.method = method;
        }

        if (callback) {
            request(options, (err, response, body) => {
                let payload;
                try {
                    payload = JSON.parse(body);
                } catch (e) {
                    payload = body;
                }
                if (err || response.statusCode < 200 || response.statusCode > 299) {
                    callback(err || new Error(`Response code ${response.statusCode}`), payload);
                } else {
                    if (_.isArray(payload)) {
                        payload = _.map(payload, (item) => {
                            return this._doBeautifications(item, type);
                        });
                    } else {
                        payload = this._doBeautifications(payload);
                    }
                    callback(err, payload);
                }
            });
        } else {
            return new Promise((resolve, reject) => {
                request(options, (err, response, body) => {
                    let payload;
                    if (err) {
                        reject(err);
                    } else {
                        try {
                            payload = JSON.parse(body);
                        } catch (e) {
                            payload = body;
                        }

                        if (response.statusCode < 200 || response.statusCode > 299) {
                            reject(payload);
                        } else {
                            if (_.isArray(payload)) {
                                payload = _.map(payload, (item) => {
                                    return this._doBeautifications(item, type);
                                });
                            } else {
                                payload = this._doBeautifications(payload);
                            }
                            resolve(payload);
                        }
                    }
                });
            });
        }
    }

    _doBeautifications(response, route) {
        if (this.disableBeautification) {
            return response;
        }
        return this._beautifier.beautify(response, route);
    }

    _sign(queryString) {
        return crypto.createHmac('sha256', this.secret)
            .update(queryString)
            .digest('hex');
    }

    // Public APIs
    ping(callback) {
        return this._makeRequest({}, callback, 'api/v1/ping');
    }

    time(callback) {
        return this._makeRequest({}, callback, 'api/v1/time');
    }

    depth(query = {}, callback) {
        if (_.isString(query)) {
            query = { symbol: query };
        }

        return this._makeRequest(query, callback, 'api/v1/depth');
    }

    trades(query = {}, callback) {
        if (_.isString(query)) {
            query = { symbol: query };
        }

        return this._makeRequest(query, callback, 'api/v1/trades');
    }

    historicalTrades(query = {}, callback) {
        if (_.isString(query)) {
            query = { symbol: query };
        }

        return this._makeRequest(query, callback, 'api/v1/historicalTrades', 'API-KEY');
    }

    aggTrades(query = {}, callback) {
        if (_.isString(query)) {
            query = { symbol: query };
        }

        return this._makeRequest(query, callback, 'api/v1/aggTrades');
    }

    exchangeInfo(callback) {
        return this._makeRequest({}, callback, 'api/v1/exchangeInfo');
    }

    klines(query = {}, callback) {
        return this._makeRequest(query, callback, 'api/v1/klines');
    }

    ticker24hr(query = {}, callback) {
        if (_.isString(query)) {
            query = { symbol: query };
        }

        return this._makeRequest(query, callback, 'api/v1/ticker/24hr');
    }

    tickerPrice(query = {}, callback) {
        if (_.isString(query)) {
            query = { symbol: query };
        }

        return this._makeRequest(query, callback, 'api/v3/ticker/price');
    }

    bookTicker(query = {}, callback) {
        if (_.isString(query)) {
            query = { symbol: query };
        }

        return this._makeRequest(query, callback, 'api/v3/ticker/bookTicker');
    }

    allBookTickers(callback) {
        return this._makeRequest({}, callback, 'api/v1/ticker/allBookTickers');
    }

    allPrices(callback) {
        return this._makeRequest({}, callback, 'api/v1/ticker/allPrices');
    }

    // Private APIs
    newOrder(query = {}, callback) {
        return this._makeRequest(query, callback, 'api/v3/order', 'SIGNED', 'POST');
    }

    testOrder(query = {}, callback) {
        return this._makeRequest(query, callback, 'api/v3/order/test', 'SIGNED', 'POST');
    }

    queryOrder(query = {}, callback) {
        if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'api/v3/order', 'SIGNED');
    }

    cancelOrder(query = {}, callback) {
        if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'api/v3/order', 'SIGNED', 'DELETE');
    }

    openOrders(query = {}, callback) {
        if (_.isString(query)) {
            query = { symbol: query };
        }
        if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'api/v3/openOrders', 'SIGNED');
    }

    allOrders(query = {}, callback) {
        if (_.isString(query)) {
            query = { symbol: query };
        }
        if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'api/v3/allOrders', 'SIGNED');
    }

    account(callback, deprecatedCallback) {

        /*
         * Leaving deprecatedCallback in so as not to change the function signature and cause
         * problems, remove in 2.0
         */
        if (deprecatedCallback) {
            callback = deprecatedCallback;
        }

        return this._makeRequest({ timestamp: new Date().getTime() }, callback, 'api/v3/account', 'SIGNED');
    }

    myTrades(query = {}, callback) {
        if (_.isString(query)) {
            query = { symbol: query };
        }
        if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'api/v3/myTrades', 'SIGNED');
    }

    withdraw(query = {}, callback) {
        if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'wapi/v3/withdraw.html', 'SIGNED', 'POST');
    }

    depositHistory(query = {}, callback) {
        if (_.isString(query)) {
            query = { asset: query };
        }
        if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'wapi/v3/depositHistory.html', 'SIGNED');
    }

    withdrawHistory(query = {}, callback) {
        if (_.isString(query)) {
            query = { asset: query };
        }
        if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'wapi/v3/withdrawHistory.html', 'SIGNED');
    }

    depositAddress(query = {}, callback) {
        if (_.isString(query)) {
            query = { asset: query };
        }
        if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'wapi/v3/depositAddress.html', 'SIGNED');
    }

    accountStatus(callback) {
        return this._makeRequest({ timestamp: new Date().getTime() }, callback, 'wapi/v3/accountStatus.html', 'SIGNED');
    }

    startUserDataStream(callback) {
        return this._makeRequest({}, callback, 'api/v1/userDataStream', 'API-KEY', 'POST');
    }

    keepAliveUserDataStream(query = {}, callback) {
        return this._makeRequest(query, callback, 'api/v1/userDataStream', 'API-KEY', 'PUT');
    }

    closeUserDataStream(query = {}, callback) {
        return this._makeRequest(query, callback, 'api/v1/userDataStream', 'API-KEY', 'DELETE');
    }
}

module.exports = BinanceRest;
