/*jslint node: true */
var ATTR = {
    BeginProlog: '%%BeginProlog:',
    BoundingBox: '%%BoundingBox:',
    HiResBoundingBox: '%%HiResBoundingBox:',
    Pages: '%%Pages:'
};

var TAGS = {
    BeginProlog: '%%BeginProlog',
    EndProlog: '%%EndProlog'
};

var RE = {
    attrib: new RegExp(/^%%([A-Za-z]+)\:\s*(.*)\s*$/),
    bbox: new RegExp(/^%%([A-Za-z]+)\:\s*(\d+.*\d*) (\d+.*\d*) (\d+.*\d*) (\d+.*\d*)\s*$/)
};

function parseAttrib(curLine, obj) {
    var result = RE.bbox.exec(curLine);
    var box = {};
    if (result && result.length === 6) {
        //it's a bounding box
        box.x = Number(result[2]);
        box.y = Number(result[3]);
        box.width = Number(result[4]) - box.x;
        box.height = Number(result[5]) - box.y;

        obj[result[1]] = box;
    } else {
        result = RE.attrib.exec(curLine);
        if (result && result.length === 3) {
            //it's a normal attribute
            obj[result[1]] = result[2];
        }
    }
}

function parse(inputFile) {
    'use strict';

    var path = require('path');
    var readline = require('readline');
    var fs = require('fs');
    var q = require('q');
    var defer = q.defer();
    var stateStack = [];
    var commandStack = [];
    var lineReader;
    var psDOM = {
        pages: {},
        resources: {}
    };
    var inputStream = fs.createReadStream(path.resolve(inputFile));

    //catch any errors with the input stream
    inputStream.on('error', function (e) {
        defer.reject(e.toString());
    });

    //create a stream that a line at a time
    lineReader = readline.createInterface({
        input: inputStream
    });

    lineReader.on('close', function() {
        defer.resolve(psDOM);
    });

    lineReader.on('error', function (err) {
        defer.reject(err);
    });

    lineReader.on('line', function (line) {
        parseAttrib(line, psDOM);
    });

    return defer.promise;
}

exports.parse = parse;
