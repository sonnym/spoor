// # CLI Interface
// This file contains the initialization of spoor, as well as the
// process of calling a command to an integration.  Handling of
// integration and command selection is performed manually, but
// command specific arguments are handled by
// [nomnom](https://github.com/harthur/nomnom)

var fs = require("fs");
var path = require("path");

var _ = require("underscore");
var parser = require("nomnom").colors()
                              .script("spoor <integration> <command>");

var utilities = require(path.join(__dirname, "utilities"));

var commands = {};

/* workaround to fix commander */
require('keypress')(process.stdin);

// ### module.exports
// This is the main entry point for the CLI interface.  It attempts to run the user supplied
// command after loading all available integrations
module.exports = function() {
  load_integrations(function() { run_command() });
};

// ### load_integrations
// - cb Function will be called in a context with all integrations loaded
function load_integrations(cb) {
  var integrations_dir = path.join(__dirname, "..", "lib", "integrations");
  fs.readdir(integrations_dir, function(err, files) {
    _.each(files, function(file) {
      if (file.substr(-3, 3) === ".js") {
        var integration_name = file.substr(0, file.length - 3)
        commands[integration_name] = require(path.join(integrations_dir, file));
      }
    });
    cb();
  });
};

// ### run_command
// 1. check integration validity
// 2. load project and user settings
// 3. instantiate the integration
// 4. check command validity
// 5. run the command
function run_command() {
  var integration = get_next_arg();
  var command = get_next_arg();

  if (!is_integration_valid(integration)) {
    console.log(parser.getUsage());
    console.log("Invalid integration " + integration + "\n");
    console.log("Valid integrations are: " + _.keys(commands).join(", "));
    return ;
  }

  read_settings(function(settings) {
    var integration_instance = new commands[integration](settings[integration]);
    var command_runner = integration_instance.commands;

    if (!is_command_valid(command_runner, command)) {
      console.log(parser.getUsage());
      console.log("Invalid command " + command + "\n");
      console.log("Valid commands are: " + _.keys(command_runner).join(", "));
      return;
    }

    var opts_modifier = integration_instance.opts[command];
    if (opts_modifier) {
      opts_modifier(parser);
      command_runner[command].apply(null, _.values(parser.parse()));
    } else {
      command_runner[command]()
    };
  });
};

// ### is\_integration\_valid
// returns true only if the user supplied integration value is present in the commands hash
function is_integration_valid(integration) {
  return _.find(commands, function(val, key) { return key === integration });
};

// ### is\_command\_valid
// returns true if the user supplied command value is present in the
// command runner, an instantiated integration
function is_command_valid(command_runner, command) {
  return _.find(command_runner, function(val, key) { return key === command });
};

// ### read_settings
// - cb Function is passed the resulting settings JSON
//
// Read in the local settings, then merge in the global settings recursively
function read_settings(cb) {
  fs.readFile(path.join(process.cwd(), ".spoor.json"), function(err, data) {
    var settings = JSON.parse(data);

    utilities.read_user_data(function(err, data) {
      var global_settings = JSON.parse(data);

      _.each(global_settings, function(value, key) {
        if (_.has(settings, key)) {
          settings[key] = _.extend(settings[key], global_settings[key]);
        } else {
          settings[key] = global_settings[key];
        }
      });

      cb(settings);
    });
  });
};

function get_next_arg() {
  return process.argv.splice(2, 1)[0];
};

