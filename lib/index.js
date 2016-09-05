/*jslint node: true */
var ps = require('./parse-ps');

ps.parse('out.ps')
    .then(function (result) {
        console.dir(result);
        console.log('done');
    }, function (err) {
        console.log('Error encountered: ', err);
    });
