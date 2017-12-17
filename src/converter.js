'use strict';

const request = require("request");

module.exports = class CurrencyConverter {

  static convert(initAmount, initCurrency, finalCurrency) {
    let url = "https://free.currencyconverterapi.com/api/v5/convert?q=" + initCurrency + "_" + finalCurrency;
    var promise = new Promise(function(resolve, reject) {
      request.get(url, (error, response, body) => {
        if (response.statusCode == 200 || response.statusCode == 304) {
          let json = JSON.parse(body);
          resolve(json.results[initCurrency + '_' + finalCurrency].val * initAmount);
        }
        else {
          reject(Error("It broke. code: " + response));
        }
      }
    )});    
  return promise;
  }
}