'use strict';

var fs = require("fs");

var content = fs.readFileSync("./src/db.json");
content = JSON.parse(content);

module.exports = class Utils {

    static allAccountsBalance() {
        let accounts = content.data.accounts;
        let ret = [];
        for (let index in accounts) {
            let account = accounts[index]
            ret.push({
                "name" : account.name,
                "balance" : account.balance,
                "currency" : account.currency_code
            })
        };
        return ret;
    }

    static getAccounByName(name) {
        let accounts = content.data.accounts;
        for (let index in accounts) {
            if (accounts[index].name === name) {
                return accounts[index];
            }
        }
        throw "Account with name = " + name + " not found";
    }

    static getAccountBalance(name) {
        let found = Utils.getAccounByName(name);
        return {"amount" : found.balance, 
            "currency": found.currency_code}
    }

    static getTransactionsByDay(date, accountName) {
        let found = Utils.getAccounByName(accountName);
        date = new Date(date);
        return found.transactions.filter(item => 
            new Date(item.made_on).getTime() == date.getTime());
    }

    static getTransactionsByMonth(date, accountName){
        let found = Utils.getAccounByName(accountName);
        date = new Date(date);
        return found.transactions.filter(item => 
            new Date(item.made_on).getMonth() == date.getMonth() &&
            new Date(item.made_on).getFullYear() == date.getFullYear());
    }

    static getMostExpenseCategory(accountName){
        let found = Utils.getAccounByName(accountName);
        let category_cost = {};
        for(let t_index in found.transactions){
            let t = found.transactions[t_index]
            if(!(t.extra.original_category in category_cost)){
                category_cost[t.extra.original_category] = t.amount;
            } else{
                category_cost[t.extra.original_category] += t.amount;
            }
        }
        let keys = Object.keys(category_cost)
        let min_cat = keys[0];
        keys.forEach(key => {
            if (category_cost[key] < category_cost[min_cat])
                min_cat = key;
        })
        return {"category" : min_cat, 
                "amount" : category_cost[min_cat],
                "currency" : found.currency_code}
    }

    static getTransactionsInPeriod(fromDate, toDate, accountName){
        let found = Utils.getAccounByName(accountName)
        let fromDateTime = new Date(fromDate).getTime()
        let toDateTime = new Date(toDate).getTime()
        return found.transactions.filter(value =>{
            return new Date(value.made_on).getTime() >= fromDateTime && 
                   new Date(value.made_on).getTime() <= toDateTime;
        })
    }
}