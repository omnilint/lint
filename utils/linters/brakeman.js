const { execSync } = require("child_process");
const chalk = require("chalk");
const fs = require("fs");
const yaml = require("js-yaml");


function checkIfRubyIsInstalled() {
  try {
    var res = execSync("ruby -v");
    if (res) {
      console.log(res.toString());
      return true;
    }
  } catch (err) {
    return false;
  }
  return false;
}


function checkIfBrakemanIsInstalled() {
  try {
    var res = execSync("which brakeman");
    if (res) {
      return true;
    }
  } catch (err) {
    return false;
  }
  return false;
}


function installBrakeman() {
  try {
    console.log("=== Instaling Brakeman ===");
    var install_cmd = execSync("gem install Brakeman", { stdio: [0, 1, 2] });
    if (install_cmd) {
      console.log(install_cmd.toString());
      // process.exit(0);
    }
  } catch (err) {
    // console.log("=== Catch ===");
    console.log(err);
    if (err.stdout) {
      // console.log("=== Catch stdout ===");
      console.log(err.stdout.toString());
    }
    // process.exit(1);
    // console.log("=== Catch after ===");
  }
}

function runBrakeman(files) {
  var cmd = "brakeman --only-files " + files.join(",") + " -f json"
  try {
    // console.log(cmd);
    var brakemanResult = execSync(cmd, { stdio: [0] })
    if (brakemanResult) {
      // console.log(brakemanResult);
      console.log("SUCCESS");

      var output = brakemanResult.stdout.toString()
      console.log(output);
    }
  } catch (e) {
    if (e.status === 4) {
      console.log("");
      console.log("Not inside a Rails application.");
      console.log("");
    } else {
      // if (e.stderr) {
        // console.log(e.stderr.toString());
      // }
      var output = e.stdout.toString()
      console.log(output);
    }

  }

}

module.exports = {
  checkIfBrakemanIsInstalled,
  installBrakeman,
  runBrakeman
}
