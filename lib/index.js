/*jslint node: true */
var ps = require('./parse-ps');
var util = require('util');

ps.parse('test/fixtures/example-3pages-mult-links.ps')
    .then(function (result) {
        console.log(util.inspect(result.DOM, {showHidden: false, depth: null}));
        console.log('done');
    }, function (err) {
        console.log('Error encountered: ', err);
    });
