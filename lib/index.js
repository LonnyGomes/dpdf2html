/*jslint node: true */
var ps = require('./parse-ps');

ps.parse('test/fixtures/example-3pages-mult-links.ps')
    .then(function (result) {
        console.dir(result.DOM);
        console.log('done');
    }, function (err) {
        console.log('Error encountered: ', err);
    });
