const { execSync } = require("child_process");
const fs = require("fs");
const yaml = require("js-yaml");
const {
  getEnclosingGitRepository,
  isOmnilintFilePresent,
  getDotOmnilintDirectory
} = require("../filesHandler");

const dotOmnilintDirectory = getDotOmnilintDirectory();

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


function enableRule(policy_rule) {
  if (policy_rule.status == "off") {
    return false;
  } else {
    return true;
  }
}

function createErbLintConfig() {
  var rubocopConfigPath = dotOmnilintDirectory + "/tmp/rubocop.yml"
  var configContent = {
    "linters": {
      "Rubocop": {
        "enabled": true,
        "rubocop_config": {
          "inherit_from": rubocopConfigPath
        }
      }
    }
  }

  var yml = yaml.safeDump(configContent);

  // console.log("yml");
  // console.log(yml);

  if (!fs.existsSync(dotOmnilintDirectory)) {
    fs.mkdirSync(dotOmnilintDirectory);
  }
  if (!fs.existsSync(dotOmnilintDirectory + "/tmp")) {
    fs.mkdirSync(dotOmnilintDirectory + "/tmp");
  }
  fs.writeFileSync(dotOmnilintDirectory + "/tmp/.erb-lint.yml", yml);
}

function checkIfErbLintIsInstalled() {
  try {
    var res = execSync("which erblint");
    if (res) {
      return true;
    }
  } catch (err) {
    return false;
  }
  return false;
}

function checkInstalledPackages() {
  if (checkIfRubyIsInstalled()) {
    console.log("Ruby is installed");
    if (checkIfErbLintIsInstalled()) {
      console.log("ERB Lint is installed.");
    } else {
      return console.error("ERB Lint is not installed.");
    }
  } else {
    return console.error(
      "Ruby is not installed. Please install Ruby to continue."
    );
  }
}

function getExtension(file) {
  return file.split(".").pop();
}



function selectFilesForErbLint(stagedFilePaths) {
  var selectedFiles = [];
  stagedFilePaths.forEach(function(file) {
    if (
      getExtension(file).toLowerCase() === "erb"
    ) {
      selectedFiles.push(file);
    }
  });
  return selectedFiles;
}


function parseErbLintOutput(output) {
  var result = output.split("\n")
  result.shift()
  result.shift()
  result.pop()
  // result.pop()

  // var offenses = result.split("\n")
  var tmpOffenses = []

  var i,j,temparray,chunk = 3;
  for (i=0,j=result.length; i<j; i+=chunk) {
      temparray = result.slice(i,i+chunk);
      temparray.pop()
      tmpOffenses.push(temparray)
  }

  var offenses = []


  tmpOffenses.forEach(function(tmpOffense) {
    var filePath = tmpOffense[1].split(":")[1];
    if (filePath) {
      filePath = filePath.substr(1)
    }
    var message = tmpOffense[0].split(":")[1];
    if (message) {
      var slug = tmpOffense[0].split(":")[0];
      message = message.substr(1)
    } else {
      var slug = null;
      message = tmpOffense[0].split(":")[0];
    }
    var line = tmpOffense[1].split(":")[2];
    var offense = {
      filePath: filePath,
      offenses: [
        {
          slug: slug,
          message: message,
          line: line
        }
      ]
    };
    // console.log('offense')
    // console.log(offense)
    offenses.push(offense);
  });

  // console.log('offenses')
  // console.log(offenses)


  return offenses
}

function runErbLint(files) {
  var cmd = "erblint --config "+ dotOmnilintDirectory + "/tmp/.erb-lint.yml "+ files.join(" ")
  try {
    var erbLintRunner = execSync(cmd)
    if (erbLintRunner) {
      console.log(erbLintRunner.toString());
    }
  } catch (e) {
    // console.log("Error maison");
    if (e.stdout) {
      var output = e.stdout.toString();
      // console.log(output);
      // console.log('-------------------');
      var offenses = parseErbLintOutput(output)
      console.log('offenses');
      console.log(offenses);
    }
    // console.log(e);

  }
}

module.exports = {
  createErbLintConfig,
  selectFilesForErbLint,
  runErbLint
}
