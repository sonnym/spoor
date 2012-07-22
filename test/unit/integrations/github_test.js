var sinon = require("sinon");
var nock = require("nock");

var helper = require("./../../test_helper");

var github = require("./../../../lib/integrations/github");

exports.open_issues_command = function(test) {
  get_command_in_context("open_issues", "/repos/bar/baz/issues?state=open", function(output_data) {
    var mock = sinon.mock(console).expects("log").once();
    helper.wait_for(function() { return mock.callCount === 1 }, function() {
      console.log.restore();
      mock.verify();
      test.equal(mock.args[0], output_data.toString());
      test.done();
    });
  });
};

function get_command_in_context(command, path, cb) {
  helper.load_fixture("github/" + command + ".response", function(response_data) {
    nock("https://api.github.com").get(path).reply(200, response_data);

    helper.load_fixture("github/" + command + ".output", function(output_data) {
      new github({ "auth": "foo", "user": "bar", "repo": "baz" }).commands[command]();
      cb(output_data);
    });
  });
};
