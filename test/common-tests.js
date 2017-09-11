"use strict";

var assert = require('assert');
var expect = require('expect.js');
var pg0 = require('pg');
var pg = require('..');
var queryWithEmitter = require('./query-with-emitter.js');

var MiniTools = require('mini-tools');

describe('pg-promise-strict common tests', function(){
    var connectParams = {
        user: 'test_user',
        password: 'test_pass',
        database: 'test_db',
        host: 'localhost',
        port: 5432
    }
    var client;
    var poolLog;
    before(function(done){
        pg.setAllTypes();
        pg.easy=true;
        MiniTools.readConfig([{db:connectParams}, 'local-config'], {whenNotExist:'ignore'}).then(function(config){
            return pg.connect(config.db);
        }).then(function(returnedClient){
            // if(pg.poolBalanceControl().length>0) done(new Error("There are UNEXPECTED unbalanced conections"));
            pg.easy=false;
            client = returnedClient;
            done();
        });
    });
    after(function(){
        client.done();
    });
    describe('internal controls', function(){
        it('control the parameters of the execute function',function(){
            return client.query("SELECT 1").execute('one value', 'other value').then(function(result){
                done(new Error('must reject the parameters'));
            }).catch(function(err){
                expect(err.message).to.match(/must receive/);
            });
        });
        it('control the log',function(){
            var messages=[];
            pg.log=function(message){
                messages.push(message);
            };
            return Promise.resolve().then(function(){
                return client.query('select $1, $2, $3, $4, illegal syntax here', [1, "one's", true, null]).execute();
            }).catch(function(err){
                var resultExpected="ERROR! 42601, "+err.message;
                expect(messages).to.eql([
                    '------',
                    '-- select $1, $2, $3, $4, illegal syntax here',
                    '-- [1,"one\'s",true,null]',
                    "select 1, 'one\'\'s', true, null, illegal syntax here;",
                    '--'+resultExpected
                ]);
                messages=[];
                return client.query("select 'exit', 0/0 as inf").execute();
            }).catch(function(err){
                var resultExpected="ERROR! 22012, "+err.message;
                expect(messages).to.eql([
                    '------',
                    "select 'exit', 0/0 as inf;",
                    '--'+resultExpected
                ]);
                pg.log=null;
            });
        });
    });
    describe('service', function(){
        it("quoteIdent", function(){
            expect(pg.quoteIdent("column1")).to.eql('"column1"');
            expect(pg.quoteIdent('column"delta"')).to.eql('"column""delta"""');
        });
        it("quoteLiteral", function(){
            expect(pg.quoteLiteral('hi')).to.eql("'hi'");
            expect(pg.quoteLiteral("don't")).to.eql("'don''t'");
            expect(pg.quoteLiteral(7)).to.eql("'7'");
        });
        it("quoteNullable", function(){
            expect(pg.quoteNullable('hi')).to.eql("'hi'");
            expect(pg.quoteNullable("don't")).to.eql("'don''t'");
            expect(pg.quoteNullable(7)).to.eql("'7'");
            expect(pg.quoteNullable(null)).to.eql("null");
            expect(pg.quoteNullable(true)).to.eql("'true'");
        });
        it("quoteObject", function(){
            expect(pg.quoteObject("column1")).to.eql('"column1"');
            expect(pg.quoteObject('column"delta"')).to.eql('"column""delta"""');
        });
        it("quoteText", function(){
            expect(pg.quoteText('hi')).to.eql("'hi'");
            expect(pg.quoteText("don't")).to.eql("'don''t'");
        });
        it("quoteText of null", function(){
            expect(pg.quoteText(null,{allowNull:true})).to.eql('null');
        });
        it("quoteObjectList", function(){
            expect(pg.quoteObjectList(['one', '"2"'])).to.eql('"one","""2"""');
        });
    });
    describe('handle errors', function(){
        it("reject non string object names", function(){
            expect(function(){
                pg.quoteObject(null);
            }).to.throwError(/name/i);
        });
        it("reject non string text", function(){
            expect(function(){
                pg.quoteText({},{allowNull:true});
            }).to.throwError(/not text data/i);
        });
        it("reject null text", function(){
            expect(function(){
                pg.quoteText(null);
            }).to.throwError(/null/i);
        });
    });
});
