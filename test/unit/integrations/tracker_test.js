var _ = require("underscore");

var sinon = require("sinon");
var nock = require("nock");

var helper = require("./../../test_helper");

var utilities = require("./../../../lib/utilities");
var tracker = require("./../../../lib/integrations/tracker");

// TODO: add, schedule, deliver_finished

exports.todo_command = function(test) {
  helper.load_fixture("tracker/current.response", function(current_res) {
    nock("https://www.pivotaltracker.com").get("/services/v3/projects/1/iterations/current").reply(200, current_res);

    helper.load_fixture("tracker/backlog.response", function(backlog_res) {
      nock("https://www.pivotaltracker.com").get("/services/v3/projects/1/iterations/backlog").reply(200, backlog_res);

      helper.load_fixture("tracker/todo.output", function(output_data) {
        new tracker({ "token": "n/a", "project_id": 1 }).commands.todo();

        var mock = sinon.mock(console).expects("log").once();
        helper.wait_for(function() { return mock.callCount === 1 }, function() {
          console.log.restore();
          mock.verify();
          test.equal(mock.args[0], output_data.toString());
          test.done();
        });
      });
    });
  });
};

exports.current_command = function(test) {
  get_command_in_context("current", "/services/v3/projects/1/iterations/current", function(output_data) {
    var mock = sinon.mock(console).expects("log").once();
    helper.wait_for(function() { return mock.callCount === 1 }, function() {
      console.log.restore();
      mock.verify();
      test.equal(mock.args[0], output_data.toString());
      test.done();
    });
  });
};

exports.backlog_command = function(test) {
  get_command_in_context("backlog", "/services/v3/projects/1/iterations/backlog", function(output_data) {
    var mock = sinon.mock(console).expects("log").once();
    helper.wait_for(function() { return mock.callCount === 1 }, function() {
      console.log.restore();
      mock.verify();
      test.equal(mock.args[0], output_data.toString());
      test.done();
    });
  });
};

exports.scheduled_command = function(test) {
  get_command_in_context("scheduled", "/services/v3/projects/1/iterations/current_backlog", function(output_data) {
    var mock = sinon.mock(console).expects("log").once();
    helper.wait_for(function() { return mock.callCount === 1 }, function() {
      console.log.restore();
      mock.verify();
      test.equal(mock.args[0], output_data.toString());
      test.done();
    });
  });
};

exports.icebox_command = function(test) {
  get_command_in_context("icebox", "/services/v3/projects/1/stories?filter=current_state%3Aunscheduled", function(output_data) {
    var mock = sinon.mock(console).expects("log").once();
    helper.wait_for(function() { return mock.callCount === 1 }, function() {
      console.log.restore();
      mock.verify();
      test.equal(mock.args[0], output_data.toString());
      test.done();
    });
  });
};

exports.stories_command = function(test) {
  get_command_in_context("stories", "/services/v3/projects/1/stories?", function(output_data) {
    var mock = sinon.mock(console).expects("log").once();
    helper.wait_for(function() { return mock.callCount === 1 }, function() {
      console.log.restore();
      mock.verify();
      test.equal(mock.args[0], output_data.toString());
      test.done();
    });
  });
};

exports.show_command = function(test) {
  get_command_in_context("show", "/services/v3/projects/1/stories/1", [1], function(output_data) {
    var mock = sinon.mock(console).expects("log").exactly(4);
    helper.wait_for(function() { return mock.callCount === 4 }, function() {
      console.log.restore();
      test.equal(mock.args.join("\n"), output_data);
      test.done();
    });
  });
};

exports.estimate_command = function(test) {
  helper.load_fixture("tracker/estimate.response", function(response_data) {
    nock("https://www.pivotaltracker.com")
        .put("/services/v3/projects/1/stories/1", "<story><estimate>4321</estimate></story>")
        .reply(200, response_data);

    new tracker({ "token": "n/a", "project_id": 1 }).commands.estimate(1, 4321);

    var mock = sinon.mock(console).expects("log").exactly(1);
    helper.wait_for(function() { return mock.callCount === 1 }, function() {
      console.log.restore();
      test.equal(mock.args[0], "Story has been estimated");
      test.done();
    });
  });
};

_.each(["start", "finish", "deliver", "accept", "unstart"], function(verb) {
  var participle = verb + "ed"

  exports[verb + "_command"] = function(test) {
    helper.load_fixture("tracker/" + verb + ".response", function(response_data) {
      nock("https://www.pivotaltracker.com")
          .put("/services/v3/projects/1/stories/1", "<story><current_state>" + verb + "ed</current_state></story>")
          .reply(200, response_data);

      new tracker({ "token": "n/a", "project_id": 1 }).commands[verb](1);

      var mock = sinon.mock(console).expects("log").once();
      helper.wait_for(function() { return mock.callCount === 1 }, function() {
        console.log.restore();
        mock.verify();
        test.equal(mock.args[0], 'Story "Signed in shopper should be able to review order history" has been ' + participle);
        test.done();
      });
    });
  };

  exports[participle + "_command"] = function(test) {
    get_command_in_context(participle, "/services/v3/projects/1/stories?filter=current_state%3A" + participle, function(output_data) {
      var mock = sinon.mock(console).expects("log").once();
      helper.wait_for(function() { return mock.callCount === 1 }, function(){
        console.log.restore();
        mock.verify();
        test.equal(mock.args[0][0], output_data.toString());
        test.done();
      });
    });
  };
});

function get_command_in_context(command, path, cmd_args, cb) {
  if (typeof cmd_args === "function") {
    cb = cmd_args;
    cmd_args = null;
  }

  helper.load_fixture("tracker/" + command + ".response", function(response_data) {
    nock("https://www.pivotaltracker.com").get(path).reply(200, response_data);

    helper.load_fixture("tracker/" + command + ".output", function(output_data) {
      new tracker({ "token": "n/a", "project_id": 1 }).commands[command].apply(null, cmd_args);
      cb(output_data);
    });
  });
};
