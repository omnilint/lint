const { execSync } = require("child_process");
const fs = require("fs");
const yaml = require("js-yaml");
var _ = require('lodash');
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
    var line = parseInt(tmpOffense[1].split(":")[2]);
    var source = getRelevantSource(filePath, line)

    var offense = {
      file_path: filePath,
      file_name: filePath.substring(filePath.lastIndexOf("/") + 1),
      name: slug,
      message: message,
      line: line,
      severity_level: 1,
      source: source
    };
    // console.log('offense')
    // console.log(offense)
    offenses.push(offense);

  });

  // offenses = _.mapValues(_.groupBy(offenses, "filePath"));

  // console.log('offenses')
  // console.log(offenses)


  return offenses
}


function getRelevantSource(file, lineStart) {
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

//
// function createRuleCheckJson(offensesGroups, body) {
//   var rule_checks_attributes = [];
//   var file_rule_checks = [];
//
//
//
//   offensesGroups.forEach(function(offense) {
//     var relativePath = offense.file_path
//     console.log("offense");
//
//     console.log(offense);
//
//
//
//     if (offensesGroups.length == 0) {
//       var fileReport = {
//         file_name: relativePath.substring(relativePath.lastIndexOf("/") + 1 ),
//         file_path: relativePath
//       }
//       rule_checks_attributes.push(fileReport);
//     } else {
//
//       var fileReport = {};
//
//       fileReport.file_path = relativePath
//       fileReport.file_name = relativePath.substring(
//         relativePath.lastIndexOf("/") + 1
//       );
//
//       fileReport.line = offense.line;
//       // fileReport.column = offense.column;
//       // fileReport.long_message = offense.message
//       fileReport.message = offense.message
//       fileReport.name = offense.name;
//       fileReport.severity_level = 1;
//       var lines = getOffenseLine(relativePath, offense.line)
//       fileReport.source = lines
//       rule_checks_attributes.push(fileReport);
//     }
//
//   })
//
//   return rule_checks_attributes;
// }


function parseErbLintResults(offenses, body) {

  var erbLintReport = {};
  var totalError = 0;
  var totalWarn = 0;
  var totalfixableErrorCount = 0;
  var totalfixableWarnCount = 0;


  erbLintReport.name = body.content.message
  erbLintReport.commit_attempt_id = body.content.id
  erbLintReport.repository_id = body.content.repository_id
  erbLintReport.user_id = body.content.user_id
  erbLintReport.policy_id = body.policy.content.id
  erbLintReport.error_count = totalError
  erbLintReport.warning_count = offenses.count
  erbLintReport.fixable_error_count = totalfixableErrorCount
  erbLintReport.fixable_warning_count = totalfixableWarnCount
  // erbLintReport.rule_checks_attributes = createRuleCheckJson(offensesGroups, body)
  erbLintReport.rule_checks_attributes = offenses


  return erbLintReport


}

function runErbLint(files, body) {
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

      // if (desiredFormat == "simple") {
      //   parseOutPoutForRuleCheckAsText(offenses);
      // } else {
      //   parseOutPoutForRuleCheckAsTable(offenses);
      // }

      return parseErbLintResults(offenses, body);
    }
    // console.log(e);

  }
}

module.exports = {
  createErbLintConfig,
  selectFilesForErbLint,
  runErbLint
}
