var readline = require('readline');
var fs = require('fs');


var lineReader = readline.createInterface({
      input: fs.createReadStream('out.ps')
});

lineReader.on('line', function (line) {
      console.log('Line from file:', line);
});
