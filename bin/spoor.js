#!/usr/bin/env node

process.on("uncaughtException", function (err) {
  console.log("Caught exception: " + err + "\n" + err.stack);
  process.exit();
});

require("./../lib/cli").run();
