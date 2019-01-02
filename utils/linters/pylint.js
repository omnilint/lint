const fs = require("fs")
const { execSync } = require("child_process");
const chalk = require("chalk");
const ora = require("ora");
var _ = require('lodash');

const {
  getEnclosingGitRepository,
  isOmnilintFilePresent,
  getDotOmnilintDirectory
} = require("../filesHandler");

const dotOmnilintDirectory = getDotOmnilintDirectory();

function checkIfPythonIsInstalled() {
  try {
    var res = execSync("which python");
    if (res) {
      return true;
    }
  } catch (err) {
    return false;
  }
  return false;
}

function checkIfPipIsInstalled() {
  try {
    var res = execSync("which pip");
    if (res) {
      return true;
    }
  } catch (err) {
    return false;
  }
  return false;
}


function checkIfPylintIsInstalled() {
  try {
    var res = execSync("which pylint");
    if (res) {
      return true;
    }
  } catch (err) {
    return false;
  }
  return false;
}

function checkForRequirement(){
  var pythonInstalled = checkIfPythonIsInstalled()
  var pipInstalled = checkIfPipIsInstalled()
  var pylintInstalled = checkIfPylintIsInstalled()

  if (!pythonInstalled) {
    console.log("Please install Python first");
    return
  }

  if (!pipInstalled) {
    console.log("Please install pip first");
    return
  }
  if (!pylintInstalled) {
    console.log("Please install pylint first");
    return
  }

}

function formatPylintConfig(basicOptions,formatOptions, similaritiesOptions, pythonRules){
  pythonRules.forEach(rule => {
    // console.log(rule);
    if (rule.rule.content.type == "Basic") {
      basicOptions +=  "\n" + rule.rule.content.slug + " = " + rule.options[0].selected.value
    }
    if (rule.rule.content.type == "Format") {
      formatOptions += "\n" + rule.rule.content.slug + " = " + rule.options[0].selected.value

    }
    if (rule.rule.content.type == "Similaties") {
      similaritiesOptions += "\n" + rule.rule.content.slug + " = " + rule.options[0].selected.value
    }
  })
  var config = basicOptions + "\n" + formatOptions + "\n" + similaritiesOptions

  return config
}

function sortPylintConfig(rules){
  var reportOptions = "[REPORTS]\n\noutput-format=text\nreports=no"
  var basicOptions = "[BASIC]"
  var formatOptions = "[FORMAT]"
  var similaritiesOptions = "[SIMILARITIES]"
  var config = formatPylintConfig(basicOptions,formatOptions, similaritiesOptions, rules)
  return config
}



function getPythonExtension(file) {
  var extenstion = file.split(".").pop();
  return extenstion;
}

function selectFilesForPylint(stagedFilePaths) {
  var selectedFiles = [];
  stagedFilePaths.forEach(function(file) {
    if (
      getPythonExtension(file).toLowerCase() === "py"
    ) {
      selectedFiles.push(file);
    }
  });
  return selectedFiles;
}



function createPylintConfig(pylintRules) {

  var pylintRulesConfig = pylintRules

  if (!fs.existsSync(dotOmnilintDirectory)) {
    fs.mkdirSync(dotOmnilintDirectory);
  }
  if (!fs.existsSync(dotOmnilintDirectory + "/tmp")) {
    fs.mkdirSync(dotOmnilintDirectory + "/tmp");
  }
  fs.writeFileSync(dotOmnilintDirectory + "/tmp/.pylintrc", pylintRulesConfig);
}


//
// [ { message:
//      'Exactly one space required around assignment\n            encoded=encoded + letters[x]\n                   ^',
//     obj: '',
//     column: 0,
//     path: 'test.py',
//     line: 16,
//     'message-id': 'C0326',
//     type: 'convention',
//     symbol: 'bad-whitespace',
//     module: 'test' },
//   { message:
//      'Constant name "shiftArrow" doesn\'t conform to snake_case naming style',
//     obj: '',
//     column: 0,
//     path: 'test.py',
//     line: 5,
//     'message-id': 'C0103',
//     type: 'convention',
//     symbol: 'invalid-name',
//     module: 'test' },
//   { message: 'Undefined variable \'shift\'',
//     obj: '',
//     column: 40,
//     path: 'test.py',
//     line: 15,
//     'message-id': 'E0602',
//     type: 'error',
//     symbol: 'undefined-variable',
//     module: 'test' },
//   { message: 'Undefined variable \'shift\'',
//     obj: '',
//     column: 40,
//     path: 'test.py',
//     line: 22,
//     'message-id': 'E0602',
//     type: 'error',
//     symbol: 'undefined-variable',
//     module: 'test' } ]
//


// [ { filePath: '/Users/jimmy/Dev/pythonTest/a.js',
//     messages: [],
//     errorCount: 0,
//     warningCount: 0,
//     fixableErrorCount: 0,
//     fixableWarningCount: 0 } ]

function parseOutPoutForRuleCheckAsText(output) {
  // console.log("Parse");
  // console.log(output);
  var parseableOutput = Object.keys(output)

  // console.log(parseableOutput);
  const spinner = ora("No offense, bravo!");

  // console.log(parseableOutput);
  parseableOutput.forEach(function(file) {
    console.log("");
    // console.log("- " + chalk.green(file.filePath.substring(
    //   file.filePath.lastIndexOf("/") + 1
    // )))


    var relativePath = file


    // console.log(file.filePath.indexOf(directory));

    // console.log(file.filePath.substring(file.filePath.indexOf(process.cwd())))

    console.log("- " + chalk.green(relativePath));

    console.log("--------------------------------------------------------------------------------------");
    // console.log(file);


    if (output[file].length == 0) {
      spinner.succeed();
      // console.log("");
      // console.log(chalk.green("No offense in file"));
      return;
    }

    output[file].forEach(function(error){
      // console.log(error);
      var ruleName = error.symbol;
      var codeCoordinate = error.line + ":" + error.column;
      var shortMessage = error.message.split("\n")[0]
      console.log( chalk.grey(codeCoordinate) + " " + ruleName + " " + chalk.grey(shortMessage) );
    })
    // console.log("Line:Column Severity Rule Message");
    // file.messages.sort((a, b) =>
    //   b.severity > a.severity ? 1 : a.severity > b.severity ? -1 : 0
    // );
    //
    // var errorsToDisplay = sortErrorsToDisplay(file);
    // console.log(errorsToDisplay);
    // console.log(errorMessages.length);
    // file.messages.sort( function( a.severity, b.severity ) { return a.severity - b.severity });
    // errorsToDisplay.forEach(function(message) {
    //   // console.log(message);
    //   var ruleName = message.ruleId;
    //   var linterMessage;
    //   var severity;
    //   if (message.severity == 1) {
    //     linterMessage = message.message;
    //     severity = chalk.yellow("Warning");
    //   } else if (message.severity == 2) {
    //     linterMessage = message.message;
    //     severity = chalk.red("Error");
    //   }
    //   var codeCoordinate = message.line + ":" + message.column;
    //
    //   console.log(
    //     chalk.grey(codeCoordinate) +
    //       " " +
    //       severity +
    //       " " +
    //       ruleName +
    //       " " +
    //       chalk.grey(message.message)
    //   );
    // });
    // if (file.messages.length > 10) {
    //   console.log(
    //     chalk.grey(
    //       " + " +
    //         (file.messages.length - errorsToDisplay.length) +
    //         " other offenses."
    //     )
    //   );
    // }
    // // console.log("");
    // var messageToPrint = "Found ";
    // var messageToPrint2 = "Found ";
    //
    // if (file.errorCount > 0) {
    //   messageToPrint += chalk.red(file.errorCount) + " errors";
    // } else {
    //   messageToPrint += chalk.green(file.errorCount) + " error";
    // }
    //
    // if (file.warningCount > 0) {
    //   messageToPrint += ", " + chalk.yellow(file.warningCount) + " warnings.";
    // } else {
    //   messageToPrint += ", " + chalk.green(file.warningCount) + " warning.";
    // }
    //
    // if (file.fixableErrorCount > 0) {
    //   messageToPrint2 += chalk.red(file.fixableErrorCount) + " fixable errors";
    // } else {
    //   messageToPrint2 += chalk.green(file.fixableErrorCount) + " fixable error";
    // }
    //
    // if (file.fixableWarningCount > 0) {
    //   messageToPrint2 +=
    //     ", " + chalk.yellow(file.fixableWarningCount) + " fixable warnings.";
    // } else {
    //   messageToPrint2 +=
    //     ", " + chalk.green(file.fixableWarningCount) + " fixable warning.";
    // }
    // console.log(messageToPrint);
    // console.log(messageToPrint2);
    // console.log("");

    // console.log("errorCount: " + file.errorCount);
    // console.log("warningCount: " + file.warningCount);
    // console.log("fixableErrorCount: " + file.fixableErrorCount);
    // console.log("fixableWarningCount: " + file.fixableWarningCount);
  });
}




function runPylintOntStagedFiles(pythonFiles, autofix, commitAttempt, desiredFormat) {
  // console.log(files);
  // var cmd = "pylint --rcfile " + dotOmnilintDirectory + "/tmp/.pylintrc --output-format json " + pythonFiles.join(" ");
  var cmd = "pylint --output-format json " + pythonFiles.join(" ");


  // console.log(cmd);
  // pylint --rcfile .omnilint/tmp/.pylintrc --output-format json test.py
  // pylint --output-format json test.py

  try {
    // console.log("==== Try ===");
    var linter_command = execSync(cmd);
    if (linter_command) {

      var pylintOutPut = JSON.parse(err.stdout);
      var output = _.mapValues(_.groupBy(pylintOutPut, "path"));

      var files2 = Object.keys(output)

      console.log('files2');
      console.log(files2);

      if (desiredFormat == "simple") {
        parseOutPoutForRuleCheckAsText(output);
      } else {
        parseOutPoutForRuleCheckAsTable(output);
      }
      // console.log("Error");
      // console.log(parseEslintResults(output, body));
      // return parseEslintResults(output, body);
      return

    }
  } catch (err) {
    // console.log("==== Catch ===");
    // console.log(err.toString());


    if (err.stdout) {

      var pylintOutPut = JSON.parse(err.stdout);
      var output = _.mapValues(_.groupBy(pylintOutPut, "path"));

      if (desiredFormat == "simple") {
        parseOutPoutForRuleCheckAsText(output);
      } else {
        parseOutPoutForRuleCheckAsTable(output);
      }

    }
    // prepareRequestAfterLint(passed, body)
    // process.exit(1);
    // // console.log("==== Catch after ===");
  }
}



module.exports = {
  selectFilesForPylint,
  sortPylintConfig,
  createPylintConfig,
  runPylintOntStagedFiles
}
