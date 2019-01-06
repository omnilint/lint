const fs = require("fs");
const { exec, execSync, spawn } = require("child_process");
const ora = require("ora");
const chalk = require("chalk");
var _ = require('lodash');

const {
  getEnclosingGitRepository,
  isOmnilintFilePresent,
  getDotOmnilintDirectory
} = require("../filesHandler");

const dotOmnilintDirectory = getDotOmnilintDirectory();



function checkIfStyleLintIsInstalled() {
  try {
    var res = execSync("which stylelint")
    if (res) {
      // console.log(res.toString())
      return true;
    }
  } catch (err) {
    // console.log('Error')
    // console.log(err)
    return false;
  }
  return false;
}


function installStyleLint() {
  try {
    console.log("==== Instaling StyleLint ===");
    var install_cmd = execSync("npm install -g stylelint", { stdio: [0, 1, 2] });
    if (install_cmd) {
      console.log(install_cmd.toString());
      // process.exit(0);
    }
  } catch (err) {
    // console.log("==== Catch ===");
    console.log(err);
    if (err.stdout) {
      // console.log("==== Catch stdout ===");
      console.log(err.stdout.toString());
    }
    // process.exit(1);
    // console.log("==== Catch after ===");
  }
}



function getExtension(file) {
  return file.split(".").pop();
}



function selectFilesForStyleLint(stagedFilePaths) {
  var selectedFiles = [];
  stagedFilePaths.forEach(function(file) {
    if (
      getExtension(file).toLowerCase() === "sass" ||
      getExtension(file).toLowerCase() === "scss" ||
      getExtension(file).toLowerCase() === "less" ||
      getExtension(file).toLowerCase() === "sss" ||
      getExtension(file).toLowerCase() === "css" ||
      getExtension(file).toLowerCase() === "html"

    ) {
      selectedFiles.push(file);
    }
  });
  return selectedFiles;
}

function sortErrorsToDisplay(file) {
  var errorMessages = [];
  var warningMessages = [];

  if (file.warnings.length > 10) {
    file.warnings.forEach(function(message) {
      // console.log(message);
      if (message.severity == 'warning') {
        warningMessages.push(message);
        // console.log(message);
      } else {
        errorMessages.push(message);
        // console.log(message);
      }
    });
    var errorsToDisplay = warningMessages.concat(errorMessages);
    // errorsToDisplay.sort((a, b) =>
    //   b.severity > a.severity ? 1 : a.severity > b.severity ? -1 : 0
    // );
    errorsToDisplay.sort(function(a, b) {
      if (a.severity === b.severity) {
        // Line is only important when severities are the same
        if (a.line === b.line) {
          // Column is only important when lines are the same
          return a.column > b.column ? 1 : -1;
        }
        return a.line > b.line ? 1 : -1;
      }
      return b.severity < a.severity ? 1 : -1;
    });

    errorsToDisplay = errorsToDisplay.slice(0, 10);
  } else {
    // var errorsToDisplay = file.messages.sort((a, b) =>
    //   b.severity > a.severity ? 1 : a.severity > b.severity ? -1 : 0
    // );
    var errorsToDisplay = file.messages.sort(function(a, b) {
      if (a.severity === b.severity) {
        // Line is only important when severities are the same
        if (a.line === b.line) {
          // Column is only important when lines are the same
          return a.column > b.column ? 1 : -1;
        }
        return a.line > b.line ? 1 : -1;
      }
      return b.severity < a.severity ? 1 : -1;
    });
  }
  return errorsToDisplay;
}

function parseOutPoutForRuleCheckAsText(output) {
  const spinner = ora("No offense, bravo!");

  output.forEach(function(file) {
    console.log("");

    // console.log(file);
    var relativePath = file.source.replace(process.cwd() + '/', "");
    // console.log(relativePath);


    console.log("- " + chalk.green(relativePath));

    console.log("--------------------------------------------------------------------------------------");


    if (file.warnings.length == 0) {
      spinner.succeed();

      return;
    }
    file.warnings.sort((a, b) =>
      b.severity < a.severity ? 1 : a.severity < b.severity ? -1 : 0
    );
    var totalError = 0
    var totalWarn = 0
    file.warnings.forEach(function(message) {
      if (message.severity == 'warning') {
        totalWarn++
      } else if (message.severity == 'error') {
        totalError++
      }

    })
    var errorsToDisplay = sortErrorsToDisplay(file);
    errorsToDisplay.forEach(function(message) {
      // console.log(message);

      var ruleName = message.rule;
      var severity;
      if (message.severity == 'warning') {
        severity = chalk.yellow("Warning");
      } else if (message.severity == 'error') {
        severity = chalk.red("Error");
      }
      var codeCoordinate = message.line + ":" + message.column;
      // console.log(message.text.split(/[()]+/)[0]);
      console.log(
        chalk.grey(codeCoordinate) +
          " " +
          severity +
          " " +
          ruleName +
          " " +
          chalk.grey(message.text.split(/[()]+/)[0])
      );

    })

    if (file.warnings.length > 10) {
      console.log(
        chalk.grey(
          " + " +
            (file.warnings.length - errorsToDisplay.length) +
            " other offenses."
        )
      );
    }

    // console.log("");text
    var messageToPrint = "Found ";
    var messageToPrint2 = "Found ";

    if (totalError > 0) {
      messageToPrint += chalk.red(totalError) + " errors";
    } else {
      messageToPrint += chalk.green(totalError) + " error";
    }

    if (totalWarn > 0) {
      messageToPrint += ", " + chalk.yellow(totalWarn) + " warnings.";
    } else {
      messageToPrint += ", " + chalk.green(totalWarn) + " warning.";
    }


    console.log(messageToPrint);

  })

}

function getOffenseLine(file, lineStart){
  var offenseLines = []
  var allLines = fs.readFileSync(file).toString().split('\n')
  for (var i = lineStart-3; i < lineStart+2; i++) {
    if (i > -1) {
      if (typeof allLines[i] !== 'undefined') {
        offenseLines.push({line:i+1, code:allLines[i]})
      }
    }
  }
  return offenseLines
  }

function createRuleCheckJson(output, body) {
  var rule_checks_attributes = [];
  var file_rule_checks = [];

  console.log("");

  output.forEach(function(file) {
    var relativePath = file.source.replace(process.cwd() + '/', "");

    if (file.warnings.length == 0) {
      var fileReport = {
        file_name: relativePath.substring(relativePath.lastIndexOf("/") + 1 ),
        file_path: relativePath
      }
      rule_checks_attributes.push(fileReport);
      _.union(rule_checks_attributes, fileReport);


    } else {
      file.warnings.forEach(function(message) {
        // console.log(message);
        var fileReport = {};


        fileReport.file_path = relativePath
        fileReport.file_name = relativePath.substring(relativePath.lastIndexOf("/") + 1 )
        fileReport.line = message.line;
        fileReport.column = message.column;


        fileReport.message = message.text.split(/[()]+/)[0];

        // console.log(policy_rule.rule.content.slug);
        // fileReport.rule_id = message.rule

        fileReport.name = message.rule;

        if (message.severity == "warning") {
          fileReport.severity_level = 1;

        } else if (message.severity == "error") {
          fileReport.severity_level = 2;


        }



        var lines = getOffenseLine(file.source, message.line)
        fileReport.source = lines



        rule_checks_attributes.push(fileReport);

      });
    }
  });

  // console.log(rule_checks_attributes);
  return rule_checks_attributes;
}


function parseStyleLintResults(output, body) {
  var stylintReport = {};
  var totalError = 0;
  var totalWarn = 0;
  var totalfixableErrorCount = 0;
  var totalfixableWarnCount = 0;
  var fileInfo = []

  output.forEach(function(file) {
    file.warnings.forEach(function(message) {
      if (message.severity == 'warning') {
      totalWarn++
      } else if (message.severity == 'error') {
      totalError++
      }
    })
  })


  stylintReport.name = body.content.message
  stylintReport.commit_attempt_id = body.content.id
  stylintReport.repository_id = body.content.repository_id
  stylintReport.user_id = body.content.user_id
  stylintReport.policy_id = body.policy.content.id
  stylintReport.error_count = totalError
  stylintReport.warning_count = totalWarn
  stylintReport.rule_checks_attributes = createRuleCheckJson(output, body);

  // console.log(eslintReport);
  return stylintReport;
}



function runStyleLint(styleLintFiles, autofix, body, desiredFormat){

  var cmd = "stylelint " + styleLintFiles.join(" ") + " -f json"

  try {
    var styleLintRunner =  execSync(cmd)
    if (styleLintRunner) {
      // console.log("styleLintRunner Success");



      var output = JSON.parse(styleLintRunner.toString());

      if (desiredFormat == "simple") {
        parseOutPoutForRuleCheckAsText(output);
      } else {
        parseOutPoutForRuleCheckAsTable(output);
      }
      // console.log("Error");
      // console.log(parseEslintResults(output, body));
      return parseStyleLintResults(output, body);
    }
  } catch (e) {
    // if (e) {
    //   console.log("error");
    //
    //   console.log(e);
    // }
    if (e.stdout) {
      // console.log("e.stdout");
      // console.log(e.stdout.toString());

      var output = JSON.parse(e.stdout.toString());

      if (desiredFormat == "simple") {
        parseOutPoutForRuleCheckAsText(output);
      } else {
        parseOutPoutForRuleCheckAsTable(output);
      }
      // console.log("Error");
      // console.log(parseEslintResults(output, body));
      return parseStyleLintResults(output, body);


    }
  }

}




module.exports = {
  checkIfStyleLintIsInstalled,
  installStyleLint,
  runStyleLint,
  selectFilesForStyleLint
}
