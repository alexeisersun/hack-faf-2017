/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
'use strict';

const apiai = require('apiai');
const uuid = require('node-uuid');
const request = require('request');
const converter = require('./converter');
const utils = require('./utils');

module.exports = class TelegramBot {

    get apiaiService() {
        return this._apiaiService;
    }

    set apiaiService(value) {
        this._apiaiService = value;
    }

    get botConfig() {
        return this._botConfig;
    }

    set botConfig(value) {
        this._botConfig = value;
    }

    get sessionIds() {
        return this._sessionIds;
    }

    set sessionIds(value) {
        this._sessionIds = value;
    }

    constructor(botConfig, baseUrl) {
        this._botConfig = botConfig;
        var apiaiOptions = {
            language: botConfig.apiaiLang,
            requestSource: "telegram"
        };

        this._apiaiService = apiai(botConfig.apiaiAccessToken, apiaiOptions);
        this._sessionIds = new Map();

        this._webhookUrl = baseUrl + '/webhook';
        console.log('Starting bot on ' + this._webhookUrl);

        this._telegramApiUrl = 'https://api.telegram.org/bot' + botConfig.telegramToken;
    }

    start(responseCallback, errCallback){
        // https://core.telegram.org/bots/api#setwebhook
        request.post(this._telegramApiUrl + '/setWebhook', {
            json: {
                url: this._webhookUrl
            }
        }, function (error, response, body) {

            if (error) {
                console.error('Error while /setWebhook', error);
                if (errCallback){
                    errCallback(error);
                }
                return;
            }

            if (response.statusCode != 200) {
                console.error('Error status code while /setWebhook', body);
                if (errCallback) {
                    errCallback('Error status code while setWebhook ' + body);
                }
                return;
            }

            console.log('Method /setWebhook completed', body);
            if (responseCallback) {
                responseCallback('Method /setWebhook completed ' + body)
            }
        });
    }

    processMessage(req, res) {
        if (this._botConfig.devConfig) {
            console.log("body", req.body);
        }

        let updateObject = req.body;

        if (updateObject && updateObject.message) {
            let msg = updateObject.message;

            var chatId;

            if (msg.chat) {
                chatId = msg.chat.id;
            }

            let messageText = msg.text;

            console.log(chatId, messageText);

            if (chatId && messageText) {
                if (!this._sessionIds.has(chatId)) {
                    this._sessionIds.set(chatId, uuid.v1());
                }

                let apiaiRequest = this._apiaiService.textRequest(messageText,
                    {
                        sessionId: this._sessionIds.get(chatId)
                    });

                apiaiRequest.on('response', (response) => {
                    if (TelegramBot.isDefined(response.result)) {
                        let responseText = response.result.fulfillment.speech;
                        let responseData = response.result.fulfillment.data;
                        let responseIntent = response.result.metadata.intentName;

                        if (TelegramBot.isDefined(responseData) && TelegramBot.isDefined(responseData.telegram)) {
                            console.log('responseIntent 1', responseIntent);
                            let telegramMessage = responseData.telegram;
                            telegramMessage.chat_id = chatId;
                            this.reply(telegramMessage);
                            TelegramBot.createResponse(res, 200, 'Message processed');
                            console.log("Hakuna Matata");
                        } else if (TelegramBot.isDefined(responseText)) {
                            console.log('responseIntent 2', responseIntent);
                            if (responseIntent === "money.convertor.currency") {
                                    let finalCurrency = response.result.parameters['currency-name'];
                                    let accountBalance = utils.allAccountsBalance();
                                    let message = ` It seems that, converted to ${finalCurrency} you have ` ;
                                    converter.convert(accountBalance[0]['balance'], accountBalance[0]['currency'], finalCurrency)
                                        .then((val) => {
                                            message += `${val.toFixed(2)} ${finalCurrency} on your current account.`
                                            this.reply({chat_id: chatId, text: responseText + message});
                                            TelegramBot.createResponse(res, 200, 'Message processed');
                                }); 
                            } else if (responseIntent === "current.balance") {
                                let foo = utils.allAccountsBalance();
                                let current_balance = "";
                                for (var i = foo.length - 1; i >= 0; i--) {
                                    current_balance += "\nOn account " + foo[i]['name'] + " : " +
                                        foo[i]['balance'] + " " + foo[i]['currency'] + ". ";
                                }
                                this.reply({chat_id: chatId, text: responseText + current_balance});
                                TelegramBot.createResponse(res, 200, 'Message processed');
                            } else if (responseIntent === "max.expenses.domain.period") {
                                let max_expenses = "";
                                let accounts = utils.getAccounts();

                                console.log("accounts", accounts);
                                for (let index in accounts) {
                                    let expense;
                                    expense = utils.getMostExpenseCategory(accounts[index]);
                                        max_expenses += '\nFrom account ' 
                                            + accounts[index] + ' more on '
                                            + expense.category + " (namely " + expense.amount.toFixed(2)
                                            + " " + expense.currency + ").";
                                }
                                console.log("Max expense ", max_expenses);
                                this.reply({chat_id: chatId, text: responseText + max_expenses});
                                TelegramBot.createResponse(res, 200, 'Message processed');
                            } else if (responseIntent === 'last.expenses') {
                                let date = response.result.parameters.date;
                                let message = '\n';
                                let accounts = utils.getAccounts();
                                let transactions;
                                for (var i = 0; i < accounts.length; i++) {
                                    transactions = utils.getTransactionsByDay(date, accounts[i])
                                    if (transactions.length == 0) {
                                        message += `Nothing on ${accounts[i]} account. Hopefully!\n\n`
                                    } else {
                                        message += `On your ${accounts[i]} account:\n`
                                        for (var i = 0; i < transactions.length; i++) {
                                            let t = transactions[i];
                                            message += `${t.amount} ${t.currency_code} for ${t.extra.original_category}\n`;
                                        }
                                    }
                                }
                                this.reply({chat_id: chatId, text: responseText + message});
                                TelegramBot.createResponse(res, 200, 'Message processed');
                            } else {
                                this.reply({chat_id: chatId, text: responseText});
                                TelegramBot.createResponse(res, 200, 'Message processed');
                            }
                        } else {
                            console.log('Received empty speech');
                            TelegramBot.createResponse(res, 200, 'Received empty speech');
                        }
                    } else {
                        console.log('Received empty result');
                        TelegramBot.createResponse(res, 200, 'Received empty result');
                    }
                });

                apiaiRequest.on('error', (error) => {
                    console.error('Error while call to api.ai', error);
                    TelegramBot.createResponse(res, 200, 'Error while call to api.ai');
                });
                apiaiRequest.end();
            }
            else {
                console.log('Empty message');
                return TelegramBot.createResponse(res, 200, 'Empty message');
            }
        } else {
            console.log('Empty message');
            return TelegramBot.createResponse(res, 200, 'Empty message');
        }
    }

    reply(msg) {
        // https://core.telegram.org/bots/api#sendmessage
        request.post(this._telegramApiUrl + '/sendMessage', {
            json: msg
        }, function (error, response, body) {
            if (error) {
                console.error('Error while /sendMessage', error);
                return;
            }

            if (response.statusCode != 200) {
                console.error('Error status code while /sendMessage', body);
                return;
            }

            console.log('Method /sendMessage succeeded');
        });
    }

    static createResponse(resp, code, message) {
        return resp.status(code).json({
            status: {
                code: code,
                message: message
            }
        });
    }

    static isDefined(obj) {
        if (typeof obj == 'undefined') {
            return false;
        }

        if (!obj) {
            return false;
        }

        return obj != null;
    }

}