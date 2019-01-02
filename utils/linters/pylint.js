const fs = require("fs")
const { execSync } = require("child_process");
const chalk = require("chalk");
const ora = require("ora");

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





function runPylintOntStagedFiles(pythonFiles, autofix, commitAttempt, desiredFormat) {
  // console.log(files);
  var cmd =
  "pylint --rcfile " +
  dotOmnilintDirectory +
  "/tmp/.pylintrc --output-format json " +
  files.join(" ");

  // console.log(cmd);
  // pylint --rcfile .omnilint/tmp/.pylintrc --output-format json test.py

  try {
    // console.log("==== Try ===");
    var linter_command = execSync(cmd);
    if (linter_command) {

      var output = JSON.parse(linter_command);
      console.log(output);

      if (desiredFormat == "simple") {
        parseOutPoutForRuleCheckAsText(output);
      } else {
        parseOutPoutForRuleCheckAsTable(output);
      }
      // console.log("Error");
      // console.log(parseEslintResults(output, body));
      return parseEslintResults(output, body);

    }
  } catch (err) {
    // // console.log("==== Catch ===");
    console.log(err);
    //

    if (err.stdout) {

      var output = JSON.parse(err.stdout);
      console.log(output);

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
