var fs = require("fs");
var path = require("path");

var user_data_path = path.join(process.env["HOME"], ".spoor.json");

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
