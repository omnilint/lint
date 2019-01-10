const { execSync } = require("child_process");
const chalk = require("chalk");
const fs = require("fs");
const yaml = require("js-yaml");
var _ = require("lodash");
const { getRelevantSource } = require("../filesHandler");

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
    var install_cmd = execSync("gem install brakeman", { stdio: [0, 1, 2] });
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

function displayOffenseAsText(offense) {
  var ruleName = offense.name;

  var linterMessage;
  var ruleSeverity;

  if (offense.severity_level == 1) {
    linterMessage = offense.message;
    ruleSeverity = chalk.yellow("Warning");
    // warningCount++;
  } else if (offense.severity_level == 2) {
    linterMessage = offense.message;
    ruleSeverity = chalk.red("Error");
    // errorCount++;
  }

  console.log(
    offense.line + " " + ruleSeverity + " " + ruleName + " " + linterMessage
  );
}

function displayOffensesAsText(formattedBrakemanResult) {
  // console.log('formattedBrakemanResult');
  // console.log(formattedBrakemanResult);
  var groupedBrakemanResult = _.mapValues(
    _.groupBy(formattedBrakemanResult.rule_checks_attributes, "file_path")
  );
  var filePaths = Object.keys(groupedBrakemanResult);
  filePaths.forEach(function(file) {
    var warningCount = 0;
    var errorCount = 0;
    console.log("");
    console.log("- " + chalk.green(file));
    console.log(
      "--------------------------------------------------------------------------------------"
    );
    if (groupedBrakemanResult[file]) {
      groupedBrakemanResult[file].forEach(function(offense) {
        // console.log('offense');
        // console.log(offense);
        displayOffenseAsText(offense);
      });
    }
  });
}

function formatBrakemanResult(rawBrakemanResult) {
  // console.log(rawBrakemanResult.scan_info);
  // console.log();
  // console.log(rawBrakemanResult.warnings);
  var formattedBrakemanResult = {
    error_count: rawBrakemanResult.errors.length,
    warning_count: rawBrakemanResult.warnings.length,
    rule_checks_attributes: []
  };

  rawBrakemanResult.warnings.forEach(function(offense) {
    var fileReport = {};
    fileReport.file_path = offense.file;
    fileReport.file_name = offense.file.substring(
      offense.file.lastIndexOf("/") + 1
    );
    fileReport.message = offense.message;
    fileReport.linter = "brakeman";
    fileReport.line = offense.line;
    fileReport.name = offense.warning_type;
    fileReport.severity_level = 1;
    fileReport.rule_id = null;

    // fileReport.location = offense.location
    // fileReport.user_input = offense.user_input
    // fileReport.confidence = offense.confidence
    // fileReport.confidence_level = offense.confidence ?

    var lines = getRelevantSource(offense.file, offense.line);

    fileReport.source = lines;

    formattedBrakemanResult.rule_checks_attributes.push(fileReport);
  });

  return formattedBrakemanResult;
}

function runBrakeman(files) {
  var cmd = "brakeman -f json --only-files " + files.join(",");
  var output;
  try {
    // console.log(cmd);
    var brakemanResult = execSync(cmd, { stdio: [0] });
    if (brakemanResult) {
      // console.log(brakemanResult);
      // console.log("SUCCESS");
      output = brakemanResult.stdout.toString();
      // console.log(output);
    }
  } catch (e) {
    if (e.status === 4) {
      console.log("");
      console.log("Not inside a Rails application.");
      console.log("");
    } else {
      output = JSON.parse(e.stdout.toString());
      // console.log(output);
    }
  }
  var formattedBrakemanResult = formatBrakemanResult(output);

  displayOffensesAsText(formattedBrakemanResult);

  return formattedBrakemanResult;
}

module.exports = {
  checkIfBrakemanIsInstalled,
  installBrakeman,
  runBrakeman
};
