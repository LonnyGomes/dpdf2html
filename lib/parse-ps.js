/*jslint node: true */

var TAGS = {
    BeginProlog: '%%BeginProlog',
    EndProlog: '%%EndProlog',
    BeginResource: '%%BeginResource',
    EndResource: '%%EndResource',
    BeginPage: '%%Page',
    EndPage: '%%PageTrailer',
    BeginPageSetup: '%%BeginPageSetup',
    EndPageSetup: '%%EndPageSetup'
};

var RE = {
    tag: new RegExp(/^(%%[A-Za-z]+){1}(:\s*(.*)\s*)?/),
    attrib: new RegExp(/^%%([A-Za-z]+)\:\s*(.*)\s*$/),
    bbox: new RegExp(/^%%([A-Za-z]+)\:\s*(\d+.*\d*) (\d+.*\d*) (\d+.*\d*) (\d+.*\d*)\s*$/),
    resourceDesc: new RegExp(/file \(.*(obj_\d+)\)$/),
    objId: new RegExp(/(\d+) \d+ obj/)
};

var COMMANDS = {
    ANNOTATION: 'Annots',
    RESOURCE_ANNOTATION: '/Type/Annot',
    RESOURCE_RECT: '/Rect',
    RESOURCE_DEST: '/Dest'
};

var CMD_RE = {
    pageAnot: new RegExp(/^\/Annots\[/),
    pageAnotVal: new RegExp(/(\d+) \d+ R/),
    resourceStartAnot: new RegExp(/^<<\/Type\/Annot/),
    resourceEndAnot: new RegExp(/^\/Subtype\/Link>>/),
    resourceRect: new RegExp(/^\/Rect\b/),
    resourceRectVal: new RegExp(/\[(\d+\.?\d*) (\d+\.?\d*) (\d+\.?\d*) (\d+\.?\d*)\]$/),
    resourceDest: new RegExp(/^\/Dest\b/),
    resourceDestVal: new RegExp(/^\[(\d+) \d+ R .*\]/)
};

var commandStack = (function () {
    var stack = [];

    return {
        isEmpty : function () {
            return (stack.length === 0) ? true : false;
        },
        push: function (val) {
            stack.push(val);
        },
        pop: function () {
            return stack.pop();
        },
        top: function () {
            if (stack.length > 0) {
                return stack[stack.length - 1];
            } else {
                return null;
            }
        }
    };
}());

function parseAttrib(curLine, obj) {
    'use strict';

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

function processState(curLine, curState, obj, dimensions) {
    var reResult;

    if (curState) {
        switch (curState) {
        case TAGS.BeginPageSetup:
            //check for object id of page
            reResult = RE.objId.exec(curLine);
            if (reResult) {
                //extract the object id and store it
                obj.objId = 'obj_' + reResult[1];
            }

            //check for Annots definition
            reResult = CMD_RE.pageAnot.exec(curLine);
            if (reResult) {
                //start parsing through annotation
                commandStack.push(COMMANDS.ANNOTATION);

                if (!obj.links) {
                    obj.links = [];
                }
            }
            break;
        case TAGS.BeginResource:
            //check for start of annotation block
            reResult = CMD_RE.resourceStartAnot.exec(curLine);
            if (reResult) {
                //we found the start, add to command stack
                commandStack.push(COMMANDS.RESOURCE_ANNOTATION);
            }
            break;
        default:
            parseAttrib(curLine, obj);
        }
    } else {
        parseAttrib(curLine, obj);
    }

    //if command stack is not empty, process what's there
    if (!commandStack.isEmpty()) {
        switch(commandStack.top()) {
        case COMMANDS.ANNOTATION:
            reResult = CMD_RE.pageAnotVal.exec(curLine);
            if (reResult) {
                //add object key for the link resource
                obj.links.push('obj_' + reResult[1]);
            }
            //search for closing bracket
            if (curLine.indexOf(']') !== -1) {
                //we reached the end of the annoations list
                //so lets stop processing thie annotations block
                commandStack.pop();
            }
            break;
        case COMMANDS.RESOURCE_ANNOTATION:
            if (CMD_RE.resourceRect.exec(curLine)) {
                //start block for rect encountered
                commandStack.push(COMMANDS.RESOURCE_RECT);
            } else if (CMD_RE.resourceDest.exec(curLine)) {
                //start block for dest encountered
                commandStack.push(COMMANDS.RESOURCE_DEST);
            } else if (CMD_RE.resourceEndAnot.exec(curLine)) {
                //encountered end tag so pop command stack
                //to exit out of the resource annotation command
                commandStack.pop();
            }

            break;
        case COMMANDS.RESOURCE_RECT:
            reResult = CMD_RE.resourceRectVal.exec(curLine);
            if (reResult) {
                //we got the bounding box, lets make it into a
                //a rectange object with an x, y, width and height
                //we want to round values to give whole number pixels for placement
                obj.rect = {};
                obj.rect.x = Math.round(Number(reResult[1]));
                //we have to flip the y to get the 0,0 in the upper left
                obj.rect.y = Math.round(dimensions.height - Number(reResult[2]));
                obj.rect.width = Math.round(Number(reResult[3]) - obj.rect.x);
                obj.rect.height = Math.round(Number(reResult[2]) - Number(reResult[4]));
                //we processed /Rect so pop it from the stack
                commandStack.pop();
            }
            break;
        case COMMANDS.RESOURCE_DEST:
            reResult = CMD_RE.resourceDestVal.exec(curLine);
            if (reResult) {
                //set the destination object
                obj.destination = 'obj_' + reResult[1];
                //we processed /Dest so we can now pop it off the stack
                commandStack.pop();
            }
            break;
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
    var curTag;
    var lineReader;
    var psDOM = {
        pageObjects: {},
        resourceObjects: {}
    };
    var returnValue = {
        DOM: psDOM,
        getPageTotals: function () {
            return isNaN(psDOM.Pages) ? 0 : Number(psDOM.Pages);
        },
        getDimensions: function () {
            return psDOM.BoundingBox;
        },
        getCreationDate: function () {
            var d = psDOM.CreationDate;
            var re = /^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})([-+]\d{2})/;
            var dRE = re.exec(d);
            var year = Number(dRE[1]),
                month = Number(dRE[2]) - 1,
                day = Number(dRE[3]),
                hour = Number(dRE[4]),
                minutes = Number(dRE[5]),
                seconds = Number(dRE[6]);
                //tz = dRE[7];

            var dateObj = new Date(year, month, day, hour, minutes, seconds);

            //TODO: handle timezone issues
            return dateObj;
        },
        getPageData: function (pageNum) {
            var idx = isNaN(pageNum) ? '' : pageNum;
            var d = psDOM.pageObjects['page' + idx];

            return d || null;
        },
        getResourceData: function (resourceId) {
            var idx = (typeof resourceId === 'string') ? resourceId : '';
            var d = psDOM.resourceObjects[idx];

            return d || null;
        }
    };
    var domPtr = psDOM;
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
        defer.resolve(returnValue);
    });

    lineReader.on('error', function (err) {
        defer.reject(err);
    });

    lineReader.on('line', function (line) {
        var re;
        var reArg;
        var tmpTag;
        var tmpAttrib;
        var pushTag = function (tag, ptr) {
            curTag = tag;
            //console.log('adding ' + curTag);
            stateStack.push(curTag);

            if (ptr) {
                domPtr = ptr;
            }
        };
        var popTag = function (ptr) {
            curTag = stateStack.pop();
            //console.log('popping ' + curTag);
            curTag = (stateStack.length > 0) ?
                stateStack[stateStack.length - 1] : null;

            if (ptr) {
                domPtr = ptr;
            }
        };

        re = RE.tag.exec(line);
        if (re) {
            //handle states and processing
            //if we detect a start/end tag update state
            //otherwise lets prcess the current state
            tmpTag = re[1];
            reArg= re[3];
            switch(tmpTag) {
            case TAGS.BeginProlog:
                pushTag(tmpTag);
                break;
            case TAGS.BeginResource:
                //retrieve obj name used for the resource key
                //the format should be as follows
                //file (PDF <description> obj_\d+)
                tmpAttrib = RE.resourceDesc.exec(reArg)[1];
                psDOM.resourceObjects[tmpAttrib] = {};
                psDOM.resourceObjects[tmpAttrib].description = reArg;
                pushTag(tmpTag, psDOM.resourceObjects[tmpAttrib]);
                break;
            case TAGS.BeginPage:
                //Page tag contains an attribute in the following format:
                //\d \d
                //we just want the first value add it as a key
                tmpAttrib = 'page' + reArg.split(/ /)[0];
                psDOM.pageObjects[tmpAttrib] = {};
                pushTag(tmpTag, psDOM.pageObjects[tmpAttrib]);
                break;
            case TAGS.BeginPageSetup:
                pushTag(tmpTag);
                break;
            case TAGS.EndProlog:
                popTag();
                break;
            case TAGS.EndResource:
                popTag(psDOM);
                break;
            case TAGS.EndPage:
                popTag(psDOM);
                break;
            case TAGS.EndPageSetup:
                popTag();
                break;
            default:
                //it's not a tag, try to process line
                //as an attrib or command for cur state
                processState(line, curTag, domPtr, psDOM.BoundingBox);
            }
        } else {
            //process current line for given state
            processState(line, curTag, domPtr, psDOM.BoundingBox);
        }

    });

    return defer.promise;
}

exports.parse = parse;
