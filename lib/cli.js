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

var integrations_dir = path.join(__dirname, "..", "lib", "integrations");
var commands = {};

// ### run
// This is the main entry point for the CLI interface.  It attempts to run the user supplied
// command after loading all available integrations
// 1. check integration validity
// 2. load project and user settings
// 3. require and instantiate the integration
// 4. check command validity
// 5. run the command, with options if necessary
exports.run = function() {
  var integration = get_next_arg();
  var command = get_next_arg();

  with_integrations(function(integrations) {
    if (!_.include(integrations, integration)) {
      console.log(parser.getUsage());
      console.log("Invalid integration " + integration + "\n");
      console.log("Valid integrations are: " + integrations.join(", "));
      return ;
    } else {
      parser.script("spoor " + integration + " <command>");
    }

    read_settings(function(settings) {
      var included_integration = require(path.join(integrations_dir, integration + ".js"));
      var integration_instance = new included_integration(settings[integration]);

      if (!exports.is_command_valid(integration_instance, command)) {
        console.log(parser.getUsage());
        console.log("Invalid command " + command + "\n");
        console.log("Valid commands are: " + _.keys(integration_instance.commands).join(", "));
        return;
      } else {
        parser.script("spoor " + integration + " " + command);
      }

      exports.run_command(integration_instance, command);
    });
  });
};

// ### with_integrations
// - cb Function will be called with an array of integrations
function with_integrations(cb) {
  var integrations = [];

  fs.readdir(integrations_dir, function(err, files) {
    _.each(files, function(file) {
      if (file.substr(-3, 3) === ".js") {
        integrations.push(file.substr(0, file.length - 3));
      }
    });

    cb(integrations);
  });
};

// ### is\_command\_valid
// returns true if the user supplied command value is present in the
// command runner, an instantiated integration
exports.is_command_valid = function(integration_instance, command) {
  return _.find(integration_instance.commands, function(val, key) {
    return key === command
  });
};

exports.run_command = function(integration_instance, command) {
 var opts_modifier = integration_instance.opts ? integration_instance.opts[command] : null;
 var command_runner = integration_instance.commands;

 if (opts_modifier) {
   opts_modifier(parser);
   command_runner[command].call(null, parser.parse());
 } else {
   command_runner[command]();
 };
};

// ### read_settings
// - cb Function is passed the resulting settings JSON
//
// Read in the local settings, then merge in the global settings recursively
function read_settings(cb) {
  utilities.read_project_data(function(err, project_data) {
    utilities.read_user_data(function(err, user_data) {

      _.each(user_data, function(value, key) {
        if (_.has(project_data, key)) {
          project_data[key] = _.extend(project_data[key], user_data[key]);
        } else {
          project_data[key] = user_data[key];
        }
      });

      cb(project_data);
    });
  });
};

function get_next_arg() {
  return process.argv.splice(2, 1)[0];
};
