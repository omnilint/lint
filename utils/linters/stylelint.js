const fs = require("fs");
const { exec, execSync, spawn } = require("child_process");
const ora = require("ora");
const chalk = require("chalk");

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
      var linterMessage;
      var severity;
      if (message.severity == 'warning') {
        linterMessage = message.message;
        severity = chalk.yellow("Warning");
      } else if (message.severity == 'error') {
        linterMessage = message.message;
        severity = chalk.red("Error");
      }
      var codeCoordinate = message.line + ":" + message.column;

      console.log(
        chalk.grey(codeCoordinate) +
          " " +
          severity +
          " " +
          ruleName +
          " " +
          chalk.grey(message.text)
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

    // console.log("");
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

function parseStyleLintResults(output, body) {
  var eslintReport = {};
  var totalError = 0;
  var totalWarn = 0;
  var totalfixableErrorCount = 0;
  var totalfixableWarnCount = 0;
  var fileInfo = []

  output.forEach(function(file) {


    totalError += file.errorCount;
    totalWarn += file.warningCount;
    totalfixableErrorCount += file.fixableErrorCount;
    totalfixableWarnCount += file.fixableWarningCount;
  })


  eslintReport.name = body.content.message
  eslintReport.commit_attempt_id = body.content.id
  eslintReport.repository_id = body.content.repository_id
  eslintReport.user_id = body.content.user_id
  eslintReport.policy_id = body.policy.content.id
  eslintReport.error_count = totalError
  eslintReport.warning_count = totalWarn
  eslintReport.fixable_error_count = totalfixableErrorCount
  eslintReport.fixable_warning_count = totalfixableWarnCount



  eslintReport.rule_checks_attributes = createRuleCheckJson(output, body);

  // console.log(eslintReport);
  return eslintReport;
}



function runStyleLint(styleLintFiles, autofix, body, desiredFormat){

  var cmd = "stylelint " + styleLintFiles.join(" ") + " -f json"

  try {
    var styleLintRunner =  execSync(cmd)
    if (styleLintRunner) {
      console.log("styleLintRunner Success");

      console.log(styleLintRunner.toString());
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
