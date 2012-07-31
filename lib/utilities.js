var fs = require("fs");
var path = require("path");

var prompt = require("prompt");
prompt.delimiter = prompt.message = " ";

var user_data_path = path.join(process.env["HOME"], ".spoor.json");

module.exports.confirm = function(msg, cb) {
  prompt.start();
  prompt.get({ name: "yes"
             , message: msg
             , validator: /y[es]*|n[o]?/
             , warning: 'Must respond yes or no'
             , default: 'no' }, function(err, result) {
    cb(result.yes);
  });
};

module.exports.read_user_data = function(cb) {
  fs.readFile(user_data_path, function(err, data) {
    cb(err, data);
  });
};

module.exports.write_user_data = function(user_data, cb) {
  fs.writeFile(user_data_path, JSON.stringify(user_data), function(err) {
    cb(err);
  });
};
