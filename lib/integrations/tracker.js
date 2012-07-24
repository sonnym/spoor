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
var commander = require("commander");

var STORY_TYPES = ["bug", "chore", "feature", "release"];

var project_id, commands = {}, opts = {};
var common_options = { "story_id": { "position": 0
                                   , "help": "ID of the Tracker story"
                                   , "required": true
                                   }
                     }

// ## general listing commands

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

// ### stories
// displays all stories
commands.stories = function() {
  error_catcher(pivotal.getStories, [project_id, {}], function(res) {
    print_stories(res.story, "No stories to display");
  });
};

// ### show
// - story_id: Integer
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

// ## general editing commands

// ### add
// add a new story
//
// You will be prompted for the various necessary fields; once the story has
// been created, you can choose to schedule it immediately
commands.add = function() {
  get_story_attributes(function(story_attributes) {
    error_catcher(pivotal.addStory, [project_id, story_attributes], function(res) {
      console.log("\nAdded story with id: " + res.id);
      console.log("You can view it at: " + res.url + "\n");

      commander.confirm("Would you like to schedule this story? ", function(yes) {
        if (yes) schedule_story(res.id);
        process.stdin.destroy();
      });
    });
  });
};

// ### estimate
// - story_id: Integer
// - estimate: Integer
//
// quickly estimate a story
opts.estimate = function(parser) {
  parser.options({ "story_id": common_options.story_id
                 , "estimate": { "position": 1
                               , "help": "# of story points"
                               , "required": true
                               }
                 });
};
commands.estimate = function(opts) {
  update_story(opts.story_id, { "estimate": opts.estimate }, function(res) {
    console.log("Story has been estimated");
  });
};

// ### comment
// - story_id: Integer
// - comment: String
//
// comment on a story
opts.comment = function(parser) {
  parser.options({ "story_id": common_options.story_id
                 , "comment": { "position": 1
                              , "help": "Comment to be posted"
                              , "required": true
                              }
                 });
};
commands.comment = function(opts) {
  error_catcher(pivotal.addStoryComment, [project_id, opts.story_id, opts.comment], function(res) {
    console.log("Comment \"" + res.text + "\" noted by " + res.author + " at " + res.noted_at);
  });
};

// ### attach
// - story_id: Integer
// - filepath: String
// - name: Optional String
//
// attach a file directly from your file system to a Tracker story
opts.attach = function(parser) {
  parser.options({ "story_id": common_options.story_id
                 , "path": { "position": 1
                           , "help": "Location of the file to upload"
                           , "required": true
                           }
                 , "name": { "help": "Name of the file after upload"
                           , "required": false
                           }
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

    var filename = resolved_filename.substring( resolved_filename.lastIndexOf(path.sep) + 1
                                              , resolved_filename.length);
    var file_data = { "data": data, "name": opts.name || filename };

    error_catcher(pivotal.addStoryAttachment, [project_id, opts.story_id, file_data], function() {
      console.log("Upload of " + filename + " successful");
    });
  });
};

// ### schedule
// - story_id: Integer
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
  error_catcher(pivotal.deliverAllFinishedStories, [project_id], function(res) {
    console.log("All finished stories now marked as delivered");
  });
};

// ## verbal commands
//
// Verbal commands take two forms:  updating and listing.  They are formed by
// the several possible states that a story may take without special cases.
// As such, they are all written by using metaprogramming to a add all the
// functions to the commands hash.
_.each(["start", "finish", "deliver", "accept", "unstart"], function(verb) {
  // ### Updating:
  // ###### start, finish, deliver, accept, unstart
  // - story_id: Integer
  //
  // Set a specified story to selected state.
  opts[verb] = function(parser) {
    parser.option("story_id", common_options.story_id);
  };
  commands[verb] = function(opts) {
    update_story(opts.story_id, { current_state: participle }, function(res) {
      console.log("Story \"" + res.name + "\" has been " + participle);
    });
  };

  // ### Listing:
  // ###### started, finished, delivered, accepted, unstarted
  // Display a list of stories with the specified current_state filter applied.
  var participle = verb + "ed"
  commands[participle] = function() {
    error_catcher(pivotal.getStories, [project_id, { "filter": "current_state:" + participle }], function(res) {
      print_stories(res.story, "No stories are currently " + participle);
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

function update_story(story_id, params, cb) {
  error_catcher(pivotal.updateStory, [project_id, story_id, params], cb)
};

function get_story_attributes(cb) {
  var story_attributes = {};
  commander.prompt("Story Name: ", function(name) {
    story_attributes.name = name;

    console.log("Story Type:");
    commander.choose(STORY_TYPES, function(type) {
      story_attributes.story_type = STORY_TYPES[type];

      commander.prompt("Story Description:", function(description) {
        story_attributes.description = description

        commander.prompt("Estimate: ", function(estimate) {
          story_attributes.estimate = estimate;

          commander.prompt("Labels: ", function(labels) {
            story_attributes.labels = labels;
            cb(story_attributes);
          });
        });
      });
    });
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
