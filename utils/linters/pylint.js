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


function parseOutPoutForRuleCheckAsText(output) {

  var parseableOutput = Object.keys(output)

  const spinner = ora("No offense, bravo!");


  parseableOutput.forEach(function(file) {
    console.log("");

    var relativePath = file

    console.log("- " + chalk.green(relativePath));
    console.log("--------------------------------------------------------------------------------------");

    if (output[file].length == 0) {
      spinner.succeed();
      return;
    }
    output[file].forEach(function(error){
      // console.log(error);
      var ruleName = error.symbol;
      var codeCoordinate = error.line + ":" + error.column;
      var shortMessage = error.message.split("\n")[0]
      console.log( chalk.grey(codeCoordinate) + " " + ruleName + " " + chalk.grey(shortMessage) );
    })
  });
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

  var dict = [];

  // body.policy.policy_rules.forEach(function(policy_rule) {
    var parseableOutput = Object.keys(output)

    parseableOutput.forEach(function(file) {
      var relativePath = file


      if (output[file].length == 0) {
        var fileReport = {
          file_name: relativePath.substring(relativePath.lastIndexOf("/") + 1 ),
          file_path: relativePath
        }
        rule_checks_attributes.push(fileReport);
      } else {
        output[file].forEach(function(offense){
          console.log("offense");
          console.log(offense);
          var fileReport = {};

          fileReport.file_path = relativePath
          fileReport.file_name = relativePath.substring(
            relativePath.lastIndexOf("/") + 1
          );

          fileReport.line = offense.line;
          fileReport.column = offense.column;
          fileReport.long_message = offense.message
          fileReport.message = offense.message.split("\n")[0];
          // console.log(policy_rule.rule.content.slug);

          fileReport.name = offense.symbol;
          // fileReport.language_id = policy_rule.rule.content.language_id;
          fileReport.severity_level = 1;
          var lines = getOffenseLine(relativePath, offense.line)
          fileReport.source = lines
          console.log(lines);
          rule_checks_attributes.push(fileReport);
        })
      }

    })

  // });

  return rule_checks_attributes;
}


function parsePylinResults(output, body) {



  var pylintReport = {};
  var totalError = 0;
  var totalWarn = 0;
  var totalfixableErrorCount = 0;
  var totalfixableWarnCount = 0;

  var parseableOutput = Object.keys(output)

  parseableOutput.forEach(function(file) {

    if (output[file].length == 0) {


    }
    totalWarn += output[file].length

  })



  pylintReport.name = body.content.message
  pylintReport.commit_attempt_id = body.content.id
  pylintReport.repository_id = body.content.repository_id
  pylintReport.user_id = body.content.user_id
  pylintReport.policy_id = body.policy.content.id
  pylintReport.error_count = totalError
  pylintReport.warning_count = totalWarn
  pylintReport.fixable_error_count = totalfixableErrorCount
  pylintReport.fixable_warning_count = totalfixableWarnCount



  pylintReport.rule_checks_attributes = createRuleCheckJson(output, body);

  // console.log(pylintReport);
  return pylintReport;
}



function runPylintOntStagedFiles(pythonFiles, autofix, commitAttempt, desiredFormat) {

  var cmd = "pylint --output-format json " + pythonFiles.join(" ");

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

      return parsePylinResults(output, commitAttempt)

    }
  } catch (err) {



    if (err.stdout) {

      var pylintOutPut = JSON.parse(err.stdout);
      var output = _.mapValues(_.groupBy(pylintOutPut, "path"));

      if (desiredFormat == "simple") {
        parseOutPoutForRuleCheckAsText(output);
      } else {
        parseOutPoutForRuleCheckAsTable(output);
      }
      return parsePylinResults(output, commitAttempt)

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
