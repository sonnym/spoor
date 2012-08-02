// # Tracker Integration
//
// The desire for an easy to use CLI written on the node.js stack for PivotalTracker was
// a driving motivation for the creation of spoor.  As such, it is the most complete
// integration at present.
//
// We use the excellent [pivotal](https://github.com/Wizcorp/node-pivotal) project to
// integrate with Tracker.

var fs = require("fs");
var path = require("path");

var _ = require("underscore");

var Table = require("cli-table");

var pivotal = require("pivotal");
var prompt = require("prompt");
prompt.delimiter = prompt.message = " ";

var utilities = require("./../utilities");

var STORY_TYPES = ["bug", "chore", "feature", "release"];
var STORY_STATES = ["started", "finished", "delivered", "accepted", "rejected", "unstarted", "unscheduled"]

var project_id, commands = {}, opts = {};
var common_options = { "story_id": { "position": 0, "help": "ID of the Tracker story", "required": true }
                     , "type": { "abbr": "t", "help": "The type of the story", "choices": STORY_TYPES }
                     , "requested_by": { "abbr": "r", "full": "requester", "help": "Full name of the user who requested the story" }
                     , "current_state": { "abbr": "s", "full": "state", "help": "The current state of the story", "choices": STORY_STATES }
                     };

// ## setup
// retrieve the user's authentication token from pivotal tracker and save
// it in the global settings, so the user does not have to repeatedly enter
// their Tracker credentials
commands.setup = function() {
  console.log([ "We need your username and password in order to retreive your Tracker token."
              , "We will save this token in your home directory so you will not need to enter credentials again."
              ].join("\n"));

  utilities.username_and_password_prompt(function(result) {
    error_catcher(pivotal.getToken, [result.username, result.password], function(res) {
      utilities.read_user_data(function(err, user_data) {
        if (user_data) {
          user_data.tracker = { "token": res.guid }
        } else {
          user_data = { "tracker": { "token": res.guid} }
        }

        utilities.write_user_data(user_data, function(err) {
          if (err) {
            console.log("Something went wrong.");
            console.dir(err);
          } else {
            console.log("Authorization successfully retreived");
          }
        });
      });
    });
  });
};

// ## listing commands

// ### summary
// display information about the state of stories in a project
commands.summary = function() {
  error_catcher(pivotal.getStories, [project_id, {}], function(res) {
    var stories = ensure_array(res.story);

    print_summary_table(stories);
  });
};

// ### todo
// displays a list of started and unstarted stories in current, plus the entire backlog
commands.todo = function() {
  error_catcher(pivotal.getCurrentIteration, [project_id], function(current_res) {
    var stories = _.reject(current_res.iteration.stories.story, function(story) {
      return _.include(["accepted", "finished", "delivered"], story.current_state);
    });

    error_catcher(pivotal.getBacklogIterations, [project_id], function(backlog_res) {
      stories = _.sortBy(_.union(stories, get_stories_from_iterations(backlog_res.iteration)), "current_state");
      print_stories(stories, "No stories to work on");
    });
  });
};

// ### current
// displays the current iteration
commands.current = function() {
  error_catcher(pivotal.getCurrentIteration, [project_id], function(res) {
    print_stories(res.iteration.stories.story, "No stories in current iteration");
  });
};

// ### backlog
// displays all backlog iterations
commands.backlog = function() {
  error_catcher(pivotal.getBacklogIterations, [project_id], function(res) {
    print_stories(get_stories_from_iterations(res.iteration), "No stories in backlog");
  });
};

// ### scheduled
// displays anything in current or backlog that is not yet accepted
commands.scheduled = function() {
  error_catcher(pivotal.getCurrentBacklogIterations, [project_id], function(res) {
    var stories = _.reject(get_stories_from_iterations(res.iteration), function(story) {
      return story.current_state === "accepted";
    });
    print_stories(stories, "No scheduled stories stories");
  });
};

// ### icebox
// displays all unscheduled stories
commands.icebox = function() {
  error_catcher(pivotal.getStories, [project_id, { "filter": "current_state:unscheduled" }], function(res) {
    print_stories(res.story, "No stories in icebox");
  });
};

// ### unestimated
// displays all unestimated stories
commands.unestimated = function() {
  error_catcher(pivotal.getStories, [project_id, { "filter": "estimate:-1" }], function(res) {
    print_stories(res.story, "No stories to display");
  });
};

// ### stories
// - opts Object
//    - type Optional String
//    - state Optional String
//    - label Optional String
//    - done Optional Boolean
//    - requester Optional String
//
// display stories
//
// By default, all stories will be displayed, but stories can be filtered
// based on a number of flags that can be provided.  All supplied filters
// must be met for a story to be returned.
opts.stories = function(parser) {
  parser.options({ "type": common_options.type
                 , "current_state": common_options.current_state
                 , "requested_by": common_options.requested_by
                 , "label": { "abbr": "l", "help": "A label that appears on the story" }
                 , "includedone": { "abbr": "d", "full": "done", "flag": true, "default": false, "help": "Include done stories in the results" }
                 });
};
commands.stories = function(opts) {
  var filter_parts = get_filter_parts_from_opts(opts)

  if (filter_parts.length > 0) {
    console.log("Searching for stories with these attributes: " + filter_parts);
    var filter = { "filter": filter_parts.join(" ") };
  }

  error_catcher(pivotal.getStories, [project_id, filter || {}], function(res) {
    print_stories(res.story, "No stories to display");
  });
};

// ### show
// - opts Object
//     - story_id: Integer
//
// Displays the details for a particular story
//
// This gives you the all the information pertinent to a story in tabular form -
// from its basic details, to tasks, comments, and attachments
opts.show = function(parser) {
  parser.option("story_id", common_options.story_id);
};
commands.show = function(opts) {
  error_catcher(pivotal.getStory, [project_id, opts.story_id], function(story_res) {
    display_story(story_res);
  });
};

// ### labels
// list all existing labels for a project
commands.labels = function() {
  error_catcher(pivotal.getStories, [project_id, {}], function(res) {
    var stories = ensure_array(res.story);
    var labels = _.chain(stories)
                  .reduce(function(memo, story) {
                    if (story.labels) { memo.push(story.labels.split(",")) };
                    return memo;
                  }, []).flatten().uniq().sort().value();
    console.log("Labels used in this project are: " + labels.join(", "));
  });
};

// ## editing commands

// ### add
// add a new story
//
// You will be prompted for the various necessary fields; once the story has
// been created, you can choose to schedule it immediately
commands.add = function(opts) {
  get_story_attributes(opts, function(story_attributes) {
    error_catcher(pivotal.addStory, [project_id, story_attributes], function(res) {
      console.log("\nAdded story with id: " + res.id);
      console.log("You can view it at: " + res.url + "\n");

      utilities.confirm("Would you like to schedule this story?", function(yes) {
        if (yes) { schedule_story(res.id) };
      });
    });
  });
};

// ### edit
// - opts Object
//     - story_id: Integer
//     - type: String
//     - current_state: String
//     - requested_by: String
//     - label: String
//
// edit an existing story
opts.edit = function(parser) {
  parser.options({ "story_id": common_options.story_id
                 , "type": common_options.type
                 , "current_state": common_options.current_state
                 , "requested_by": common_options.requested_by
                 , "estimate": { "abbr": "e", "help": "# of story points" }
                 , "label": { "abbr": "l", "help": "Comma separated list of labels" }
                 });
};
commands.edit = function(opts) {
  var attr = {};
  _.each(opts, function(value, key) {
    if (!_.include(["_", "story_id"], key)) { attr[key] = value };
  });

  update_story(opts.story_id, attr, function() {
    console.log("Story has been updated");
  });
};

// ### rm
// - opts Object
//     - story_id: Integer
//
// remove a story
opts.rm = function(parser) {
  parser.option("story_id", common_options.story_id);
};
commands.rm = function(opts) {
  error_catcher(pivotal.removeStory, [project_id, opts.story_id], function(story) {
    console.log("Story \"" + story.name + "\" has been removed");
  });
};

// ### estimate
// - opts Object
//     - story_id: Integer
//     - estimate: Integer
//
// quickly estimate a story
opts.estimate = function(parser) {
  parser.options({ "story_id": common_options.story_id
                 , "estimate": { "position": 1, "help": "# of story points", "required": true }
                 });
};
commands.estimate = function(opts) {
  update_story(opts.story_id, { "estimate": opts.estimate }, function() {
    console.log("Story has been estimated");
  });
};

// ### comment
// - opts Object
//     - story_id: Integer
//     - comment: String
//
// comment on a story
opts.comment = function(parser) {
  parser.options({ "story_id": common_options.story_id
                 , "comment": { "position": 1, "help": "Comment to be posted", "required": true }
                 });
};
commands.comment = function(opts) {
  error_catcher(pivotal.addStoryComment, [project_id, opts.story_id, opts.comment], function(res) {
    console.log("Comment \"" + res.text + "\" noted by " + res.author + " at " + res.noted_at);
  });
};

// ### add_task
// - opts Object
//     - story_id: Integer
//     - task: String
//
// add a task to a story
opts.add_task = function(parser) {
  parser.options({ "story_id": common_options.story_id
                 , "task": { "position": 1, "help": "Text of task to be added", "required": true }
                 });
};
commands.add_task = function(opts) {
  error_catcher(pivotal.addTask, [project_id, opts.story_id, { "description": opts.task }], function() {
    console.log("Task has been added");
  });
};

// ### complete_task
// - opts Object
//     - story_id: Integer
//     - task_id: Integer
//
// complete the specified task
opts.complete_task = function(parser) {
  parser.options({ "story_id": common_options.story_id
                 , "task_id": { "position": 1, "help": "ID of the task to complete", "required": true }
                 });
};
commands.complete_task = function(opts) {
  error_catcher(pivotal.updateTask, [project_id, opts.story_id, opts.task_id, { "complete": true } ], function () {
    console.log("Task has been completed");
  });
};

// ### attach
// - opts Object
//     - story_id: Integer
//     - filepath: String
//     - name: Optional String
//
// attach a file directly from your file system to a Tracker story
opts.attach = function(parser) {
  parser.options({ "story_id": common_options.story_id
                 , "path": { "position": 1, "help": "Location of the file to upload", "required": true }
                 , "name": { "help": "Name of the file after upload", "required": false }
                 });
};
commands.attach = function(opts) {
  var resolved_filename = path.resolve(process.cwd(), opts.path)
  fs.readFile(resolved_filename, function(err, data) {
    if (err) {
      console.log("Unable to read file");
      console.dir(err);
      return;
    }

    var filename = resolved_filename.substring(resolved_filename.lastIndexOf(path.sep) + 1)
    var file_data = { "data": data, "name": opts.name || filename };

    error_catcher(pivotal.addStoryAttachment, [project_id, opts.story_id, file_data], function() {
      console.log("Upload of " + filename + " successful");
    });
  });
};

// ### schedule
// - opts Object
//     - story_id: Integer
//
// move a story to the end of the backlog (regardless of current location)
opts.schedule = function(parser) {
  parser.option("story_id", common_options.story_id);
};
commands.schedule = function(opts) {
  schedule_story(opts.story_id, function() {
    console.log("Story has been scheduled");
  });
};

// ### deliver_finished
// deliver all finished stories - perfect for a roll out to staging
commands.deliver_finished = function() {
  error_catcher(pivotal.deliverAllFinishedStories, [project_id], function() {
    console.log("All finished stories now marked as delivered");
  });
};

// ## verbal commands
//
// Verbal commands take two forms:  updating and listing.  They are formed by
// the several possible states that a story may take without special cases.
// As such, they are all written by using metaprogramming to a add all the
// functions to the commands hash.
_.each(STORY_STATES, function(participle) {
  /* scheduling and rejection is not as straightforward */
  if (participle === "unscheduled" || participle === "rejected") { return };

  // ### Listing:
  // ###### started, finished, delivered, accepted, unstarted
  // Display a list of stories with the specified current_state filter applied.
  commands[participle] = function() {
    error_catcher(pivotal.getStories, [project_id, { "filter": "current_state:" + participle }], function(res) {
      print_stories(res.story, "No stories are currently " + participle);
    });
  };

  // ### Updating:
  // ###### start, finish, deliver, accept, unstart
  // - opts Object
  //     - story_id: Integer
  //
  // Set a specified story to selected state.
  var verb = participle.slice(0, -2);
  opts[verb] = function(parser) {
    parser.option("story_id", common_options.story_id);
  };
  commands[verb] = function(opts) {
    update_story(opts.story_id, { current_state: participle }, function(res) {
      console.log("Story \"" + res.name + "\" has been " + participle);
    });
  };
});

// ### constructor
// Process settings hash
//
// - settings: Object
//     - token: String a Pivotal Tracker authentication token
//     - project_id: Integer a Traker project id to which you have write access
module.exports = function(settings) {
  if (settings) {
    if (settings.token) pivotal.useToken(settings.token);
    if (settings.project_id) project_id = settings.project_id;
  }

  return { "commands": commands, "opts": opts };
};

function print_summary_table(stories) {
  var story_count = _.size(stories);

  /* count stories by type and state */
  var story_buckets = _.reduce(STORY_TYPES, function(memo, type) {
    memo[type] = _.reduce(STORY_STATES, function(inner_memo, state) {
      inner_memo[state] = 0;
      return inner_memo;
    }, {});
    return memo;
  }, {});

  _.each(stories, function(story) {
    story_buckets[story.story_type][story.current_state]++
  });

  /* prepare headers */
  var headers = _.clone(STORY_STATES);
  headers.unshift("");
  headers.push("total");

  /* generate table rows */
  var story_table = new Table({ "head": headers });
  _.each(story_buckets, function(type_row, key) {
    var kvp = {};
    var values = _.values(type_row);

    /* add total to row */
    values.push(_.reduce(values, function(memo, v) { return memo += v }));

    /* add percentages to cells */
    values = _.map(values, function(v) { return v + " (" + parseInt(v * 100 / story_count) + " %)" });

    kvp[key] = values;
    story_table.push(kvp);
  });

  /* add totals row */
  var total_values = _.map(STORY_STATES, function(state) {
    var sum = _.chain(story_buckets)
               .pluck(state)
               .reduce(function(memo, v) { return memo += v })
               .value();

    return sum + " (" + parseInt(sum * 100 / story_count) + " %)";
  });
  total_values.push(story_count + " (100 %)")
  story_table.push({ "totals": total_values });

  console.log(story_table.toString());
};

function print_stories(stories, no_stories_message) {
  if (!stories || stories.length === 0) {
    console.log(no_stories_message);
    return;
  }

  var table = new Table({ head: ["Name", "ID", "Type", "State", "Estimate", "Labels"] });

  _.each(ensure_array(stories), function(story) {
    table.push([ story.name, story.id, story.story_type, story.current_state, story.estimate || "none", story.labels || ""]);
  });

  console.log(table.toString());
};

function display_story(story) {
  var basic_table = new Table();
  var basic_fields = ["name", "current_state", "estimate", "requested_by", "labels", "description"];
  _.each(basic_fields, function(key) {
    var kvp = {};
    var value = story[key];

    kvp[key] = typeof value === 'object' ? "" : value;

    basic_table.push(kvp);
  });

  console.log("General Information:\n" + basic_table.toString());

  var comments = (story.notes && story.notes.note) ? ensure_array(story.notes.note) : null;
  if (comments) {
    var comment_table = new Table({ head: [ "Comment", "Author", "Timestamp" ] });
    _.each(comments, function(comment) {
      comment_table.push([ comment.text, comment.author, comment.noted_at ]);
    });
    console.log("Comments:\n" + comment_table.toString());
  }

  var tasks = (story.tasks && story.tasks.task) ? ensure_array(story.tasks.task) : null;
  if (tasks) {
    var task_table = new Table({ head: [" ", "Task", "ID"] });
    _.each(tasks, function(task) {
      task_table.push([ task.complete === "true" ? "✓" : " ", task.description, task.id ]);
    });
    console.log("Tasks:\n" + task_table.toString());
  };

  var attachments = (story.attachments && story.attachments.attachment)
                  ? ensure_array(story.attachments.attachment) : null;
  if (attachments) {
    var attachment_table = new Table({ head: ["Filename", "Uploader", "URL"] });
    _.each(attachments, function(attachment) {
      attachment_table.push([ attachment.filename, attachment.uploaded_by, attachment.url ]);
    });
    console.log("Attachments:\n" + attachment_table.toString());
  }
};

function get_stories_from_iterations(iterations) {
  if (!iterations) {
    return [];
  }

  iterations = ensure_array(iterations);
  return _.flatten(_.map(iterations, function(iteration) {
    return iteration.stories.story;
  }));
};

function schedule_story(story_id, cb) {
  error_catcher(pivotal.getCurrentBacklogIterations, [project_id], function(res) {
    var last_story_in_backlog = _.last(get_stories_from_iterations(res.iteration));
    if (last_story_in_backlog && last_story_in_backlog.id) {
      error_catcher(pivotal.moveStory, [project_id, story_id, { target: last_story_in_backlog.id, move: "after" }], function(res) {
        if (cb) {
          cb();
        }
      });
    };
  });
};

function get_filter_parts_from_opts(opts) {
  var wrap_with_quotes = function(val) {
    return (_.isString(val) && val.match(/\s/)) ? '"' + val + '"' : val;
  };

  return _.reduce(opts, function(memo, val, key) {
    if (key !== "_") {
      memo.push(key + ":" + wrap_with_quotes((_.isArray(val) ? val.join(",") : val)));
    }
    return memo;
  }, []);
};

function update_story(story_id, params, cb) {
  error_catcher(pivotal.updateStory, [project_id, story_id, params], cb)
};

function get_story_attributes(opts, cb) {
  var schema = { properties:
                  { name: { message: "Story Name"
                          , required: true
                          }
                  , story_type: { message: "Story Type"
                                , required: true
                                , enum: STORY_TYPES
                                , warning: "Story type must be one of: [" + STORY_TYPES.join(", ") + "]"
                                }
                  , description: { message: "Description"
                                 , required: false
                                 }
                  , estimate: { message: "Estimate"
                              , required: false
                              }
                  , labels: { message: "Labels"
                            , required: false
                            }
                  }
               };

  prompt.override = opts;
  prompt.start();
  prompt.get(schema, function(err, story_attributes) {
    cb(story_attributes);
  });
};

function ensure_array(obj) {
  return _.isArray(obj) ? obj : [obj];
};

function error_catcher(fn, args, cb) {
  args.push(function(err, res) {
    if (err) {
      console.log("An API error occurred.  Please be sure you typed everything correctely.");
      console.log(err);
      return;
    }
    if (cb) cb(res);
  });

  fn.apply(this, args);
};
