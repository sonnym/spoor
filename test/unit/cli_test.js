var helper = require("./../test_helper");

var cli = require("./../../lib/cli");

exports.is_command_valid = function(test) {
  test.ok(cli.is_command_valid({ "commands": { "foo": "bar" } }, "foo"));
  test.ok(!cli.is_command_valid({ "commands": { "foo": "bar" } }, "baz"));

  test.done();
};

exports.specified_command_is_run = function(test) {
  var integration_instance = { "commands": { "test_fn": function() { test.done() } } };
  cli.run_command(integration_instance, "test_fn");
};
