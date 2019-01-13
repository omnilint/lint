const { execSync } = require("child_process");
const chalk = require("chalk");
const fs = require("fs");
const yaml = require("js-yaml");
var _ = require("lodash");
const { getRelevantSource } = require("../filesHandler");
const ora = require("ora");





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
    chalk.grey("Line " + offense.line) + " " + ruleSeverity + " " + ruleName + " " + chalk.grey(linterMessage)
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
    // console.log("No Offenses");

    if (groupedBrakemanResult[file]) {
      // console.log("Offenses");
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
  // console.log(rawBrakemanResult);
  // console.log(rawBrakemanResult);


  var formattedBrakemanResult = {
    error_count: 0,
    warning_count: rawBrakemanResult.warnings.length || 0,
    linter: "brakeman",
    rule_checks_attributes: []

  };
  if (rawBrakemanResult.warnings.length > 0) {
    rawBrakemanResult.warnings.forEach(function(offense) {
      var fileReport = {};
      fileReport.file_path = offense.file;
      fileReport.file_name = offense.file.substring(
        offense.file.lastIndexOf("/") + 1
      );
      fileReport.message = offense.message;
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
  }

  // console.log('rawBrakemanResult.errors');
  // console.log(rawBrakemanResult.errors);
  if (rawBrakemanResult.errors.length > 0) {
    rawBrakemanResult.errors.forEach(function(offense) {

      console.log(offense);


      // Resultat Brakeman
      // { error:
      //    'invalid byte sequence in US-ASCII While processing /Users/jimmy/Dev/gatrix/app/views/commit_attempts/show.html.erb',
      //   location:
      //    '/Users/jimmy/.rvm/gems/ruby-2.5.3/gems/brakeman-4.3.1/lib/brakeman/parsers/rails3_erubis.rb:78:in 'gsub\'' }


      var tmp_1 = offense.error
      var line;
      var name;
      var message;
      var absoluteFilePath;
      if (tmp_1.split(" :: ").length > 1) {
        var tmp_2 = tmp_1[0]
        var tmp_3 = tmp_2.split(":")
        absoluteFilePath = tmp_3[0]
        line = parseInt(tmp_3[1])
        if (tmp_1[1]) {
          message = tmp_1[1].replace(/^\w/, c => c.toUpperCase());
        }
        name = offense.location.replace(absoluteFilePath, 'file.');
      } else {
        absoluteFilePath = tmp_1.substring(tmp_1.lastIndexOf(" "));
        message = tmp_1;
        name = tmp_1.replace(absoluteFilePath, ' file.');
      }

      var relativePath = absoluteFilePath.replace(process.cwd() + "/", "");

      console.log("$$$ absoluteFilePath:", absoluteFilePath);
      console.log("$$$ relativePath:", relativePath);
      console.log("$$$ line:", line);
      console.log("$$$ message:", message);
      console.log("$$$ name:", name);

      var fileReport = {};
      fileReport.file_path = relativePath;
      fileReport.file_name = relativePath.substring(
        relativePath.lastIndexOf("/") + 1
      );
      fileReport.message = message;
      fileReport.line = line;
      fileReport.name = name;
      fileReport.severity_level = 2;
      fileReport.rule_id = null;
      formattedBrakemanResult.error_count += 1

      if (line) {
        var lines = getRelevantSource(absoluteFilePath, line);
        fileReport.source = lines;
      }


      formattedBrakemanResult.rule_checks_attributes.push(fileReport);

      if (offense.file) {
        var fileReport = {};
        fileReport.file_path = offense.file;
        fileReport.file_name = offense.file.substring(
          offense.file.lastIndexOf("/") + 1
        );
        fileReport.message = offense.message;
        fileReport.line = offense.line;
        fileReport.name = offense.warning_type;
        fileReport.severity_level = 2;
        fileReport.rule_id = null;
        formattedBrakemanResult.error_count += 1
        // fileReport.location = offense.location
        // fileReport.user_input = offense.user_input
        // fileReport.confidence = offense.confidence
        // fileReport.confidence_level = offense.confidence ?

        var lines = getRelevantSource(offense.file, offense.line);

        fileReport.source = lines;

        formattedBrakemanResult.rule_checks_attributes.push(fileReport);
      }
    });

  }
  return formattedBrakemanResult;
}

function runBrakeman(files) {
  var sanitizedFiles = [];
  files.forEach(function(file) {
    if (file.lastIndexOf(" ") == -1) {
      sanitizedFiles.push(file)
    }
  })
  var cmd = "brakeman -f json --only-files " + sanitizedFiles.join(",");
  var output;
  try {
    // console.log(cmd);
    var brakemanResult = execSync(cmd, { stdio: [0] });
    if (brakemanResult) {
      // console.log(brakemanResult);
      // console.log(brakemanResult.toString());
      output = JSON.parse(brakemanResult.toString());
      // console.log(output);
      var formattedBrakemanResult = formatBrakemanResult(output);

      // console.log("formattedBrakemanResult");
      // console.log(formattedBrakemanResult);

      // displayOffensesAsText(formattedBrakemanResult);

      // return formattedBrakemanResult;

      // console.log(output);
    }
  } catch (e) {
    if (e.status === 4) {
      console.log("");
      console.log("Not inside a Rails application.");
      console.log(e);
      return
    } else {
      if (e.stdout) {
        // console.log(e.stdout);
        output = JSON.parse(e.stdout.toString());
      }
      // console.log(output);
    }
  }
  var formattedBrakemanResult = formatBrakemanResult(output);

  if (formattedBrakemanResult.rule_checks_attributes.length == 0) {
    console.log("");
    ora("No offense").succeed()
  }
  displayOffensesAsText(formattedBrakemanResult);

  return formattedBrakemanResult;
}

module.exports = {
  checkIfBrakemanIsInstalled,
  installBrakeman,
  runBrakeman
};
