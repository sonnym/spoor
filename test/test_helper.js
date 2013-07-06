var fs = require("fs");
var path = require("path");

var self = module.exports;

self.load_fixture = function(name, cb) {
  fs.readFile(path.join(__dirname, "fixtures", name), function(err, response) {
    if (err) {
      throw err;
    }
    cb(response);
  });
};

self.wait_for = function(condition, cb) {
  (function wait() {
    if (condition()) {
      cb();
    } else {
      setImmediate(wait);
    }
  })();
};
