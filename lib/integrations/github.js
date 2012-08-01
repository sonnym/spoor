// # Github Integration
//

var _ = require("underscore");

var utilities = require("./../utilities");

var GitHubApi = require("github");
var Table = require("cli-table");

var github = new GitHubApi({ "version": "3.0.0"});
var prompt = require("prompt");

var authenticated, user, repo, commands = {};

// ## setup
// creates an authentication token for the user so they do not have to input
// their credentials repeatedly
commands.setup = function() {
  if (authenticated) {
    console.log("Authorization token already exists.");
    utilities.confirm("Are you sure you want to continue? ", function (yes) {
      if (yes) { create_authorization() };
    });
  } else {
    create_authorization();
  }
};

// ## listing commands

// ### open_issues
// display all open issues
commands.open_issues = function() {
  github.issues.repoIssues({ "user": user, "repo": repo, "state": "open" }, function(err, issues) {
    if (err) { console.dir(err) };
    print_issues(issues, "No open issues");
  });
};

// ### constructor
// The constructor for this module takes a hash of settings values, and prepares
// the instantiated module for communicating with github.  The token can be
// generated and stored by the setup method.
//
// - settings: Object
//     - token: String a Github oauth authentication token
//     - user: String the Github user which holds the repository for this project
//     - repo: String the name of the repository for this project
module.exports = function(settings) {
  if (settings) {
    if (settings.token) {
      github.authenticate({ "type": "oauth", "token": settings.token });
      authenticated = true;
    }
    user = settings.user;
    repo = settings.repo;
  }

  return { "commands": commands, "opts": {} };
};

// This function perfoms all the legwork for setting up github integration for this user
// It asks for cerdentials in order to use Basic Authentication to register a new token
// with github.
function create_authorization() {
  console.log([ "We need your username and password in order to generate an OAuth token."
              , "We will save this token in your home directory so you will not need to enter credentials again."
              ].join("\n"));

  utilities.username_and_password_prompt(function(result) {
    var params = { "scopes": ["repo"] , "note": "spoor" , "note_url": "https://github.com/sonnym/spoor" };

    github.authenticate({ "type": "basic", "username": result.username, "password": result.password });
    github.oauth.createAuthorization(params, function(err, res) {
      utilities.read_user_data(function(err, user_data_raw) {
        var user_data = JSON.parse(user_data_raw);

        if (user_data) {
          user_data.github = { "token": res.token }
        } else {
          user_data = { "github": { "token": res.token } }
        }

        utilities.write_user_data(user_data, function(err) {
          if (err) {
            console.log("Something went wrong.");
            console.dir(err);
          } else {
            console.log("Authorization successfully created");
          }
        });
      });
    });
  });
};

function print_issues(issues, no_issues_message) {
  if (!issues || issues.length === 0) {
    console.log(no_issues_message);
    return;
  }

  var table = new Table({ head: ["Title", "ID", "User", "Labels", "Comments"] });

  _.each(issues, function(issue) {
    var labels = _.map(issue.labels, function(label) { return label.name }).join(", ");
    table.push([ issue.title, issue.id, issue.user.login, labels, issue.comments ]);
  });

  console.log(table.toString());
}
