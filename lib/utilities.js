var fs = require("fs");
var path = require("path");

var prompt = require("prompt");
prompt.delimiter = prompt.message = " ";

// ## settings helpers

var user_data_path = path.join(process.env["HOME"], ".spoor.json");
var project_data_path = path.join(process.cwd(), ".spoor.json");

module.exports.read_user_data = function(cb) {
  fs.readFile(user_data_path, function(err, user_data_raw) {
    if (err) { cb(err) };

    try {
      var data = JSON.parse(user_data_raw);
    } catch(e) { cb(e) };

    cb(null, data);
  });
};

module.exports.write_user_data = function(user_data, cb) {
  fs.writeFile(user_data_path, JSON.stringify(user_data), function(err) {
    cb(err);
  });
};

module.exports.read_project_data = function(cb) {
  fs.readFile(project_data_path, function(err, project_data_raw) {
    if (err) { cb(err) };

    try {
      var data = JSON.parse(project_data_raw);
    } catch(e) { cb(e) };

    cb(null, data);
  });
};

module.exports.write_project_data = function(key, project_data, cb) {
  this.read_project_data(function(err, project_settings) {
    if (err) { cb(err) };

    project_settings[key] = project_data;

    fs.writeFile(project_data_path, JSON.stringify(project_settings), function(err) {
      cb(err);
    });
  });
};

// ## prompt helpers
module.exports.confirm = function(msg, cb) {
  prompt.start();
  prompt.get({ name: "yes"
             , message: msg
             , validator: /y[es]*|n[o]?/
             , warning: 'Must respond yes or no'
             , default: 'no' }, function(err, result) {
    cb(result.yes === "y" || result.yes === "yes");
  });
};

module.exports.username_and_password_prompt = function(cb) {
  var schema = { properties:
    { username: { message: "Username"
                , required: true
                }
    , password: { message: "Password"
                , required: true
                , hidden: true
                }
    }
  };

  prompt.start();
  prompt.get(schema, function(err, result) { cb(result) });
};
