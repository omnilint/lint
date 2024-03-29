const fs = require("fs");
const os = require("os");
// const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const request = require("request");
// const simpleGit = require("simple-git");
const dns = require("dns");
var CliTable = require("cli-table");
// var CLIEngine = require("eslint").CLIEngine;
// var SourceCode = require("eslint").SourceCode;
var eslint = require("eslint");
// var { Linter, SourceCode } = require("eslint");
const { execSync } = require("child_process");
const prettier = require("prettier");
const {
  createESlintConfig,
  runEslint,
  parseOutPoutForRuleCheck,
  assignESlintRules,
  selectFilesForESLint,
  checkIfLintStagedConfigExist,
  checkIfEslintIsInstalled,
  parseOutPoutForRuleCheckAsText,
  parseOutPoutForRuleCheckAsTable,
  parseEslintResults,
  installEslint
} = require("./linters/eslint");

const {
  createPrettierConfig,
  formatPrettierRules,
  askToRunPrettier,
  runPrettierOnStagedFiles,
  selectFilesForPrettier,
  setParser,
  checkIfPrettierIsInstalled,
  installPrettier
} = require("./linters/prettier");

const {
  checkInstalledPackages,
  selectFilesForRuboCop,
  createRubocopConfig,
  enableRule,
  runRubocop,
  runRubocopJson,
  checkIfRubocopIsInstalled,
  installRubocop
} = require("./linters/rubocop");

const {
  getUsernameFromLocalDevice,
  getTokenFromLocalDevice
} = require("./user");

const {
  getEnclosingGitRepository,
  isLintFilePresent,
  getDotLintDirectory,
  isLocalInstall,
  rimraf,
  copyFileSync,
  copyFolderRecursiveSync,
  copyRecursiveSync,
  parseLintFile
} = require("./filesHandler");

const ROOT_PATH = os.homedir();
// const localUsernamePath = `/.lint/refs/user`;
// const usernameDir = path.join(ROOT_PATH, localUsernamePath);

const API_BASE_URL = "https://api.omnilint.com";
const DEV_API_BASE_URL = "http://localhost:3000";

// var executionStartTime;
var executionStartTime = new Date();

function savePaths(paths) {
  const dotLintDirectory = getDotLintDirectory();
  if (!fs.existsSync(dotLintDirectory)) {
    fs.mkdirSync(dotLintDirectory);
  }
  if (!fs.existsSync(dotLintDirectory + "/tmp")) {
    fs.mkdirSync(dotLintDirectory + "/tmp");
  }
  fs.writeFileSync(dotLintDirectory + "/tmp/staged", paths);
}

function saveReport(report) {
  const dotLintDirectory = getDotLintDirectory();
  if (!fs.existsSync(dotLintDirectory)) {
    fs.mkdirSync(dotLintDirectory);
  }
  if (!fs.existsSync(dotLintDirectory + "/tmp")) {
    fs.mkdirSync(dotLintDirectory + "/tmp");
  }
  var stringifiedReport = JSON.stringify(report);
  // console.log(stringifiedReport);
  fs.writeFileSync(dotLintDirectory + "/tmp/report", stringifiedReport);
}

// Use of eslint with lint-staged//
function lintingPreCommit(desiredFormat, keep, time) {
  // console.log(desiredFormat);
  // console.log('startESLintPreCommit');
  var eslintRules = {};
  var rubocopRules = {
    AllCops: {
      DisabledByDefault: true
    }
  };

  // repoOwner = "reyemneirda";
  // repoName = "todolist";

  const repositoryUUID = parseLintFile();
  // const repositoryUUID = "reyemneirda/react-tic-tac-toe";
  // console.log('repositoryUUID');
  // console.log(repositoryUUID);

  // var executionStartTime = new Date()
  // executionStartTime = new Date();

  if (!repositoryUUID) {
    console.log(
      "Please init repository first by running " +
        chalk.green("lint init") +
        "."
    );
    process.exit(1);
  }

  // repoName = "command-line-test";
  checkInternet(function(isConnected) {
    // Terminate when no internet access
    if (!isConnected) {
      console.log("Not connected to the Internet.");
      process.exit(1);
    }
    var stagedFilePaths = getStagedFiles(time);
    var removedFiles = getDeletedStagedFiles();
    // console.log("stagedFilePaths");
    // console.log(stagedFilePaths);
    // console.log(stagedFilePaths.length);
    //
    // console.log("removedFiles");
    // console.log(removedFiles);
    // console.log(removedFiles.length);
    const spinner = ora("Fetching repository policy...");
    if (stagedFilePaths.length === 0 && removedFiles.length === 0) {
      // spinner.succeed("No staged files.");
      console.log("No staged files.");
      process.exit(0);
      return;
    } else {
      spinner.start();
      setTimeout(() => {
        spinner.color = "yellow";
      }, 2000);
      savePaths(stagedFilePaths);
    }
    var jsFiles = selectFilesForESLint(stagedFilePaths);
    var rubyFiles = selectFilesForRuboCop(stagedFilePaths);
    var prettierFiles = selectFilesForPrettier(stagedFilePaths);
    // connected to the internet
    createCommitAttempt(repositoryUUID)
      .then(body => {
        // spinner.succeed("Policy fetched: " + chalk.bold.magenta(body.policy.content.name));

        if (body.policy && body.policy.content.name) {
          if (time) {
            spinner.succeed(
              "Policy fetched in " +
                (new Date() - executionStartTime) +
                "ms: " +
                chalk.bold.magenta(body.policy.content.name)
            );
          } else {
            spinner.succeed(
              "Policy fetched: " + chalk.bold.magenta(body.policy.content.name)
            );
          }
        } else {
          if (time) {
            spinner.succeed(
              "No policy - Fetched in " +
                (new Date() - executionStartTime) +
                "ms."
            );
          } else {
            spinner.succeed("No policy.");
          }
        }

        spinner.start("Writing linter configuration...");
        var filterRulesStartTime = new Date();
        // sleep(3000)
        // spinner.start("Configuration set");

        // console.log(fetchSHA());
        var prettier_rules = {};
        saveCommitAttemptId(body.content.id);
        if (
          body.policy &&
          body.policy.policy_rules &&
          body.policy.policy_rules.length > 0
        ) {
          body.policy.policy_rules.forEach(function(policy_rule) {
            var obj = {
              Enabled: enableRule(policy_rule)
            };
            if (prettierFiles.length > 0) {
              prettier_rules = formatPrettierRules(prettier_rules, policy_rule);
            }
            // console.log("test");
            // console.log(policy_rule);

            var es_lint_selected_options = {};
            var rubocopSelectedOptions = {};
            var name = policy_rule.slug;

            if (
              policy_rule.linter &&
              policy_rule.linter.command == "eslint" &&
              jsFiles.length > 0
            ) {
              if (policy_rule.options.length === 0) {
                eslintRules[name] = policy_rule.status;
              }
              policy_rule.options.forEach(function(option) {
                var rule_option = option.rule_option;
                if (rule_option) {
                  switch (rule_option.value_type) {
                    case "integer":
                      // console.log("integer");
                      es_lint_selected_options[rule_option.slug] = parseInt(
                        option.selected.value
                      );
                      break;
                    case "boolean":
                      // console.log("Boolean");
                      var isTrueSet = option.selected.value == "true";
                      es_lint_selected_options[rule_option.slug] = isTrueSet;
                      break;
                    case "string":
                      // console.log("String");
                      es_lint_selected_options[rule_option.slug] =
                        option.selected.value;
                      break;
                    case "array-single":
                      eslintRules[name] = [
                        policy_rule.status,
                        option.selected.value
                      ];
                      break;
                    case "array-multiple":
                      // console.log("array-multiple");
                      if (option.rule_option_options.length == 0) {
                        // console.log("0 choice");
                        eslintRules[name] = policy_rule.status;
                      } else if (option.rule_option_options.length == 1) {
                        // console.log("1 choice");
                        options.push(option.rule_option_options[0].value);
                        es_lint_selected_options[rule_option.slug] = options;
                      } else if (option.rule_option_options.length > 1) {
                        // console.log("More than 1 choice");
                        option.rule_option_options.forEach(function(
                          rule_option_option
                        ) {
                          options.push(rule_option_option.value);
                        });
                        es_lint_selected_options[rule_option.slug] = options;
                      }
                      break;
                    default:
                  }

                  // Check if options are selected
                  if (Object.keys(es_lint_selected_options).length > 0) {
                    eslintRules[name] = [
                      policy_rule.status,
                      es_lint_selected_options
                    ];
                  }
                } else {
                  eslintRules[name] = policy_rule.status;
                  // console.log(name);
                  // console.log(policy_rule.status);
                }
              });
            }
            // if (policy_rule.linter &&
            // policy_rule.linter.command) {
            //   console.log(chalk.green(policy_rule.linter.command));
            //   console.log(name);
            //
            // }

            if (
              policy_rule.linter &&
              policy_rule.linter.command == "rubocop" &&
              rubyFiles.length > 0
            ) {
              if (policy_rule.options.length == 0) {
                if (policy_rule.status == "warn") {
                  obj["Severity"] = "warning";
                  rubocopRules[name] = obj;
                } else if (policy_rule.status == "error") {
                  obj["Severity"] = policy_rule.status;
                  rubocopRules[name] = obj;
                }
              }
              policy_rule.options.forEach(function(option) {
                var rule_option = option.rule_option;
                if (rule_option) {
                  switch (rule_option.value_type) {
                    case "integer":
                      rubocopSelectedOptions[rule_option.slug] = parseInt(
                        option.selected.value
                      );
                      break;
                    case "boolean":
                      // console.log("Boolean");
                      var isTrueSet = option.selected.value == "true";
                      rubocopSelectedOptions[rule_option.slug] = isTrueSet;
                      break;
                    case "string":
                      // console.log("String");
                      rubocopSelectedOptions[rule_option.slug] =
                        option.selected.value;
                      break;
                    case "array-single":
                      rubocopSelectedOptions[rule_option.slug] =
                        option.selected.value;
                      break;
                    case "array-multiple":
                      // console.log("array-multiple");
                      if (option.rule_option_options.length == 0) {
                        // console.log("0 choice");
                        rubocopRules[name] = policy_rule.status;
                      } else if (option.rule_option_options.length == 1) {
                        // console.log("1 choice");
                        options.push(option.rule_option_options[0].value);
                        rubocopSelectedOptions[rule_option.slug] = options;
                      } else if (option.rule_option_options.length > 1) {
                        // console.log("More than 1 choice");
                        option.rule_option_options.forEach(function(
                          rule_option_option
                        ) {
                          options.push(rule_option_option.value);
                        });
                        rubocopRules[rule_option.slug] = options;
                      }
                      break;
                    default:
                  }
                  if (policy_rule.status == "warn") {
                    rubocopSelectedOptions["Severity"] = "warning";
                  } else if (policy_rule.status == "error") {
                    rubocopSelectedOptions["Severity"] = policy_rule.status;
                  }

                  var jsonObj = rubocopSelectedOptions;
                  if (jsonObj) {
                    var merge = Object.assign(obj, jsonObj);
                  } else {
                    var merge = obj;
                  }
                  rubocopRules[name] = merge;
                }
              });
            }
            // console.log("Afterloop")
            //
            // console.log(rubocopRules)
            //
          });
          var autofix = false;
          if (body.repository && body.repository) {
            var autofix = body.repository.has_autofix;
          }

          // var eslintCli = new CLIEngine({
          //   envs: ["browser", "es6", "node"],
          //   fix: autofix,
          //   useEslintrc: false,
          //   rules: eslintRules
          // });
        } else {
          console.log("No policy rules.");
        }

        // console.log(eslintRules);
        // console.log(eslintCli);

        //  process.exit(1);
        // createLintStagedConfig();
        // console.log(eslintRules);
        // console.log(rubocopRules);
        // spinner.succeed("Configuration set.");

        // var writeConfigurationFilesSpinner = ora("Writing configuration files...").start();
        // var writeConfigurationFilesTime = new Date();
        if (jsFiles.length > 0) {
          createESlintConfig(eslintRules);
        }
        if (rubyFiles.length > 0) {
          createRubocopConfig(rubocopRules);
        }
        if (prettierFiles.length > 0) {
          createPrettierConfig(prettier_rules);
        }
        if (time) {
          spinner.succeed(
            "Configuration set in " +
              (new Date() - filterRulesStartTime) +
              "ms."
          );
        } else {
          spinner.succeed("Configuration set.");
        }

        // writeConfigurationFilesSpinner.succeed("Configuration written in " + (new Date() - writeConfigurationFilesTime) + "ms.");
        // console.log( chalk.grey("Execution time: " + (new Date() - executionStartTime) + "ms.") );

        lintStaged(
          autofix,
          body,
          desiredFormat,
          prettier_rules,
          jsFiles,
          rubyFiles,
          prettierFiles
        )
          .then(report => {
            saveReport(report);
            postReport(report, time)
              .then(report => {
                // var executionEndTime = new Date() - executionStartTime;
                // console.log("");
                if (time) {
                  console.log(
                    chalk.grey(
                      "Total execution time: " +
                        (new Date() - executionStartTime) +
                        "ms."
                    )
                  );
                }
                if (!report.passed) {
                  spinner.fail("Commit aborted. Please fix your code first.");
                  // console.log(
                  //   chalk.red("Commit Aborded. Fix your code first.")
                  // );
                }
                var stringifyReport = readReport();
                // console.log(stringifyReport);
              })
              .catch(error => {
                console.log(error);
                reject();
                process.exit(2);
              });
          })
          .catch(function(e) {
            console.log(e);
            console.log(chalk.red("Commit Aborded. Fix your code first."));
            if (!keep) {
              rimraf("./.lint/tmp/");
            }
            process.exit(1);
            // Expected output: "Success!"
          });
        //
        //
        // // execution time simulated with setTimeout function
        // var executionEndTime = new Date() - executionStartTime
        // console.info('Execution time: %dms', executionEndTime)
      })
      .catch(function(e) {
        console.log("Error during CommitAttempt creation.");
        console.log(e);
        process.exit(1);
        // expected output: "Success!"
      });
  });
}

function swapFiles(stagedFilePaths) {
  var paths = stagedFilePaths;
  var dotLintDirectory = getDotLintDirectory();
  var enclosingRepository = getEnclosingGitRepository();
  paths.forEach(path => {
    if (!fs.existsSync(dotLintDirectory + "/tmp/plain/")) {
      fs.mkdirSync(dotLintDirectory + "/tmp/plain/");
    }
    copyRecursiveSync(path, dotLintDirectory + "/tmp/plain/");
    // copyFolderRecursiveSync(path, dotLintDirectory + "/tmp/plain/")
    // var pathWithoutLastDirectory = path.substring(0, path.lastIndexOf('/'))
    // if (fs.lstatSync(pathWithoutLastDirectory).isDirectory()) {
    //   copyFolderRecursiveSync(pathWithoutLastDirectory, dotLintDirectory +
    //     "/tmp/plain/")
    // } else {
    //   copyFileSync(
    //     path,
    //     dotLintDirectory +
    //       "/tmp/plain/"
    //   );
    // }
  });
}

// Check if we are connected to internet
function checkInternet(cb) {
  dns.lookup("omnilint.com", function(err) {
    if (err && err.code == "ENOTFOUND") {
      cb(false);
    } else {
      cb(true);
    }
  });
}

function saveCommitAttemptId(commit_attempt_id) {
  const dotLintDirectory = getDotLintDirectory();
  if (!fs.existsSync(dotLintDirectory)) {
    fs.mkdirSync(dotLintDirectory);
  }
  if (!fs.existsSync(dotLintDirectory + "/tmp")) {
    fs.mkdirSync(dotLintDirectory + "/tmp");
  }
  fs.writeFileSync(
    dotLintDirectory + "/tmp/commit_attempt_id",
    commit_attempt_id
  );
}

function readCommitAttempId() {
  if (fs.existsSync("./.lint/tmp/commit_attempt_id")) {
    const commit_attempt_id = fs.readFileSync(
      "./.lint/tmp/commit_attempt_id"
    );
    return commit_attempt_id.toString();
  } else {
    console.error("No commit attempt found");
  }
}

// Fetch commit attempt
function createCommitAttempt(repositoryUUID) {
  // console.log("createCommitAttempt");
  return new Promise((resolve, reject) => {
    const currentUser = getUsernameFromLocalDevice();
    const token = getTokenFromLocalDevice();
    // const token = "v5NnNqL3C9bQyrzUfzDxTnmvztPr8PMheTebeF8zr7VKozq1uQ";

    if (!repositoryUUID) {
      reject(new Error("Unable to get repositoryUUID."));
      process.exit(1);
    }
    if (!token) {
      console.log("Please log in first.");
      reject(new Error("Unable to get token."));
      process.exit(1);
    }

    const url = `${API_BASE_URL}/${repositoryUUID}/commit_attempts.json?user_token=${token}`;
    // console.log(url);
    request.post(
      url,
      {
        json: {
          commit_attempt: {
            branch_name: fetchbranch()
          }
        }
      },
      function(error, response, body) {
        // console.log(url);
        // console.log(response);
        // console.log(body);
        if (response) {
          if (!error && response.statusCode == 201) {
            // console.log('Commit Attempt created.');
            var stringify = JSON.stringify(body);
            // console.log(stringify);
            resolve(body);
          } else {
            // console.log("No request");
            // console.log(url);

            console.log(response.statusCode);
            console.log(error);
            // console.log(body);
            reject(new Error("Unable to post to server."));
            process.exit(1);
          }
        } else {
          console.error(new Error("Unable to connect."));
          // console.log(error);
          reject(error);
        }
        reject(error);
      }
    );
  });
}

function fetchSHA() {
  try {
    var git_result = execSync("git rev-parse HEAD");
    if (git_result) {
      return git_result.toString();
    }
  } catch (err) {
    console.log(err);
  }
}

function fetchbranch() {
  try {
    var git_result = execSync("git rev-parse --abbrev-ref HEAD");
    if (git_result) {
      return git_result.toString();
    }
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
}

function checkIfAutofixEnabled(body) {
  return body.policy.autofix;
}

function getDeletedStagedFiles() {
  try {
    var git_staged_result = execSync(
      // "git diff-index --cached --name-only HEAD"
      "git diff --name-only --cached"
    );
    if (git_staged_result) {
      var stagedFilePaths = git_staged_result
        .toString()
        .replace(/[\r]+/g, "")
        .split("\n")
        .slice(0, -1);
    }
    var removedFiles = [];
    stagedFilePaths.forEach(file => {
      if (!fs.existsSync(file)) {
        removedFiles.push(file);
      }
    });
    return removedFiles;
  } catch (err) {
    console.log("Error getting Staged Files in linter.js");
    console.log(err);
    process.exit(1);
  }
}

function getStagedFiles(time) {
  try {
    var stagedFilesSpinner = ora("Checking git staged files.").start();
    var stagedFilesStartTime = new Date();
    // spinner.succeed("Policy fetched in "  + (new Date() - executionStartTime) + "ms: " + chalk.bold.magenta(body.policy.content.name));

    // var git_staged_result = execSync( "git diff-index --cached --name-only HEAD --diff-filter=ACMRT" );
    // if (git_staged_result) {
    //   var stagedFilePaths = git_staged_result
    //     .toString()
    //     .replace(/[\r]+/g, "")
    //     .split("\n")
    //     .slice(0, -1);
    // }
    var git_staged_result = execSync(
      // "git status -s"
      "git diff --name-only --cached"
    );
    // console.log('git_staged_result');
    // console.log(git_staged_result.toString());
    if (git_staged_result) {
      var stagedFilePaths = git_staged_result
        .toString()
        .replace(/[\r]+/g, "")
        .split("\n")
        .slice(0, -1);
      // .substring(3);
      // Remove first 3 characters at the begining of each file to get rid of the A, M, D etc.
      // stagedFilePaths.forEach((file, index) => {
      //   // stagedFilePaths[index] = file.substring(3);
      //   console.log(stagedFilePaths[index]);
      // });
    }
    // console.log('stagedFilePaths');
    // console.log(stagedFilePaths);

    // stagedFilePaths.forEach(file => {
    //   console.log(file);
    // });
    // var displayTime = false;
    if (stagedFilePaths.length > 0) {
      if (time) {
        stagedFilesSpinner.succeed(
          stagedFilePaths.length +
            " staged files fetched in " +
            (new Date() - stagedFilesStartTime) +
            "ms."
        );
      } else {
        stagedFilesSpinner.succeed(stagedFilePaths.length + " staged files.");
      }
    } else {
      stagedFilesSpinner.stop();
    }

    return stagedFilePaths;
  } catch (err) {
    console.log("Error getting Staged Files in linter.js.");
    console.log(err);
    process.exit(1);
  }
}

function lintStaged(
  autofix,
  body,
  desiredFormat,
  prettier_rules,
  jsFiles,
  rubyFiles,
  prettierFiles
) {
  return new Promise((resolve, reject) => {
    var report = {};
    // fs.readFileSync( process.env.GIT_PARAMS );
    // var stagedFilePaths = getStagedFiles();

    // if (stagedFilePaths.length === 0) {
    //   console.log("No staged files.");
    //   console.log("");
    //    process.exit(0);
    //   return;
    // }
    if (!body.policy) {
      report.passed = true;
      resolve(report);
      return;
    }

    if (autofix) {
      console.log("");
      var autofixEnabled = ora("Autofix enabled.").succeed();
    }

    var javascriptReports = {};
    var rubyReports = {};

    var prettierHasSucceed = true;

    if (prettierFiles.length > 0) {
      // console.log("Before prettierFiles");
      console.log("");
      // console.log(
      //   "************************************************************************"
      // );
      // console.log(
      //   "******************************* Prettier *******************************"
      // );
      // console.log(
      //   "************************************************************************"
      // );
      console.log(chalk.bold.cyan("Running Prettier..."));
      // console.log("");
      // console.log("About to make " + prettierFiles.length + " file(s) prettier.");
      // console.log(prettierFiles);
      console.log("");

      const dotLintDirectory = getDotLintDirectory();
      var configFile = dotLintDirectory + "/tmp/prettierrc";
      try {
        var prettier_fails = 0;
        prettierFiles.forEach(filePath => {
          var parser = setParser(filePath);

          const text = fs.readFileSync(filePath, "utf8");

          prettier.resolveConfig.sync(filePath, {
            config: configFile, // or parser: "php"
            parser: parser
          });

          var formatted = prettier.format(text, {
            config: configFile, // or parser: "php"
            parser: parser
          });
          // console.log(formatted);
          // console.log(filePath);

          fs.writeFileSync(filePath, formatted, "utf8");
          var fileFormatted = prettier.check(formatted, {
            config: configFile, // or parser: "php"
            parser: parser
          });
          if (fileFormatted) {
            console.log("- " + chalk.green(filePath) + " is prettier");
            // console.log("----------------------------------------------");
          } else {
            prettier_fails = prettier_fails + 1;
            console.log("Did not made " + filePath + " prettier");
          }
        });
        // console.log("");
        if (prettier_fails > 0) {
          prettierHasSucceed = false;
        }
      } catch (e) {
        console.log("Prettier failure:");

        if (e.loc && e.loc.start) {
          var error_at_line = e.loc.start + "";
          console.log(error_at_line);
        } else {
          console.log(e);
        }

        var prettierHasSucceed = false;
      }
      // var prettierHasSucceed = runPrettierOnStagedFiles(prettierFiles, body);
    }
    if (jsFiles.length > 0) {
      console.log("");
      // console.log(
      //   "************************************************************************"
      // );
      // console.log(
      //   "******************************** ESLint ********************************"
      // );
      // console.log(
      //   "************************************************************************"
      // );
      console.log(chalk.bold.cyan("Running ESLint..."));

      // console.log("");
      // console.log("About to lint " + jsFiles.length + " Javascript file(s).");
      // console.log(
      //   "Linter is coming for " + jsFiles.length + " Javascript file(s):"
      // );
      // console.log(jsFiles);
      // javascriptReports = runEslint(jsFiles, autofix, body, desiredFormat);
      // var linting = eslintCli.executeOnFiles(jsFiles);

      const dotLintDirectory = getDotLintDirectory();
      const enclosingGitRepository = getEnclosingGitRepository();
      var configFile = JSON.parse(
        fs.readFileSync(dotLintDirectory + "/tmp/eslintrc")
      );

      var linter = new eslint.Linter();
      // var output = [];
      var output = [];
      // var output = linting.results;
      jsFiles.forEach(file => {
        var fileContent = fs.readFileSync(enclosingGitRepository + "/" + file);
        var rulesResultForFile;
        if (autofix) {
          rulesResultForFile = linter.verifyAndFix(
            fileContent.toString(),
            configFile,
            {
              filename: file
            }
          );
          var errorCount = 0;
          var warningCount = 0;
          var fixableErrorCount = 0;
          var fixableWarningCount = 0;
          rulesResultForFile.messages.forEach(result => {
            if (result.severity == 1) {
              warningCount += 1;
            }
            if (result.severity == 2) {
              errorCount += 1;
            }
            if (result.fix) {
              if (result.severity == 1) {
                fixableWarningCount += 1;
              }
              if (result.severity == 2) {
                fixableErrorCount += 1;
              }
            }
          });
          fs.writeFileSync(file, rulesResultForFile.output, "utf8");
        } else {
          rulesResultForFile = linter.verify(
            fileContent.toString(),
            configFile,
            {
              filename: file
            }
          );
          var errorCount = 0;
          var warningCount = 0;
          var fixableErrorCount = 0;
          var fixableWarningCount = 0;
          // console.log(rulesResultForFile);
          rulesResultForFile.forEach(result => {
            if (result.severity == 1) {
              warningCount += 1;
            }
            if (result.severity == 2) {
              errorCount += 1;
            }
            if (result.fix) {
              if (result.severity == 1) {
                fixableWarningCount += 1;
              }
              if (result.severity == 2) {
                fixableErrorCount += 1;
              }
            }
          });
        }
        var messages;
        if (autofix) {
          messages = rulesResultForFile.messages;
        } else {
          messages = rulesResultForFile;
        }
        var resultForFile = {
          filePath: file,
          messages: messages,
          errorCount: errorCount,
          warningCount: warningCount,
          fixableErrorCount: fixableErrorCount,
          fixableWarningCount: fixableWarningCount
        };
        output.push(resultForFile);
      });

      // console.log(output);
      // var output = linter.verify(code, configFile, { filename: "foo.js" });
      var javascriptReports = parseEslintResults(output, body);
      if (desiredFormat == "simple") {
        parseOutPoutForRuleCheckAsText(output);
      } else {
        parseOutPoutForRuleCheckAsTable(output);
      }

      // console.log(javascriptReports.results);

      // console.log("Linting Done");
    } else {
      javascriptReports.error_count = 0;
      javascriptReports.warning_count = 0;
      javascriptReports.fixable_error_count = 0;
      javascriptReports.fixable_warning_count = 0;
      javascriptReports.rule_checks_attributes = [];
      //  process.exit(0);
      // console.error("No Javascript Files Found");
    }

    if (rubyFiles.length > 0) {
      // console.log("");
      // console.log(
      //   "************************************************************************"
      // );
      // console.log(
      //   "******************************** Rubocop *******************************"
      // );
      // console.log(
      //   "************************************************************************"
      // );
      // console.log("");

      console.log(chalk.bold.cyan("Running Rubocop..."));

      // console.log(
      //   "Linter is coming for " + rubyFiles.length + " Ruby file(s):"
      // );
      // console.log("About to lint " + rubyFiles.length + " Ruby file(s):");

      // console.log(rubyFiles);

      rubyReports = runRubocopJson(rubyFiles, autofix, body, desiredFormat);
      // runRubocop(rubyFiles, autofix);
      // console.log("Linting Done");
    } else {
      rubyReports.error_count = 0;
      rubyReports.warning_count = 0;
      rubyReports.fixable_error_count = 0;
      rubyReports.fixable_warning_count = 0;
      rubyReports.rule_checks_attributes = [];
    }

    report.name = body.content.message;
    report.commit_attempt_id = body.content.id;
    report.policy_id = body.policy.content.id;
    report.repository_id = body.content.repository_id;
    report.user_id = body.content.user_id;

    report.error_count =
      javascriptReports.error_count + rubyReports.error_count;
    report.warning_count =
      javascriptReports.warning_count + rubyReports.warning_count;
    report.fixable_error_count =
      javascriptReports.fixable_error_count + rubyReports.fixable_error_count;
    report.fixable_warning_count =
      javascriptReports.fixable_warning_count +
      rubyReports.fixable_warning_count;
    //
    // if (
    //   javascriptReports.rule_checks_attributes &&
    //   rubyReports.rule_checks_attributes
    // ) {
    //
    //   report.rule_checks_attributes = javascriptReports.rule_checks_attributes.concat(
    //     rubyReports.rule_checks_attributes
    //   );
    // } else if (javascriptReports.rule_checks_attributes) {
    //   report.rule_checks_attributes = javascriptReports.rule_checks_attributes;
    // } else if (rubyReports.rule_checks_attributes) {
    //   report.rule_checks_attributes = rubyReports.rule_checks_attributes;
    // } else {
    //   report.rule_checks_attributes = [];
    // }

    var ruleChecks = {};
    if (
      javascriptReports.rule_checks_attributes &&
      rubyReports.rule_checks_attributes
    ) {
      // console.log("javascriptReports.rule_checks_attributes");
      // console.log(javascriptReports.rule_checks_attributes);

      ruleChecks.rule_checks_attributes = javascriptReports.rule_checks_attributes.concat(
        rubyReports.rule_checks_attributes
      );
    } else if (javascriptReports.rule_checks_attributes) {
      ruleChecks.rule_checks_attributes =
        javascriptReports.rule_checks_attributes;
    } else if (rubyReports.rule_checks_attributes) {
      ruleChecks.rule_checks_attributes = rubyReports.rule_checks_attributes;
    } else {
      ruleChecks.rule_checks_attributes = [];
    }
    // console.log("ruleChecks");
    // console.log(ruleChecks);
    //
    //
    // console.log("ruleChecks.rule_checks_attributes");
    // console.log(ruleChecks.rule_checks_attributes);

    report.report = {
      rule_checks_attributes: ruleChecks.rule_checks_attributes
    };
    //
    // console.log("report.report");
    // console.log(report.report);
    if (
      body.policy.content.prevent_commits_on_errors &&
      report.error_count > 0
    ) {
      report.passed = false;
    } else if (
      !prettierHasSucceed &&
      body.policy.content.prevent_commits_on_errors
    ) {
      report.passed = false;
    } else {
      report.passed = true;
    }
    if (report) {
      resolve(report);
    } else {
      reject();
    }
  });
}

function postReport(report, time) {
  // console.log(report);
  // console.log("");
  const reportSpinner = ora("Creating report...");
  reportSpinner.start();
  const token = getTokenFromLocalDevice();
  // const token = "v5NnNqL3C9bQyrzUfzDxTnmvztPr8PMheTebeF8zr7VKozq1uQ";
  var postUrl = `${API_BASE_URL}/policy_checks.json?user_token=${token}`;
  var reportStartTime = new Date();
  return new Promise((resolve, reject) => {
    request.post(
      postUrl,
      {
        json: {
          policy_check: report
        }
      },
      function(error, response, policy_check) {
        if (response) {
          if (!error && response.statusCode === 201) {
            if (time) {
              reportSpinner.succeed(
                "Report saved in " + (new Date() - reportStartTime) + "ms."
              );
            } else {
              reportSpinner.succeed("Report saved.");
            }
            // console.log( chalk.grey("Execution time: " + (new Date() - executionStartTime) + "ms.") );

            // console.log("");
            // console.log("Policy Check Saved.");
            // var policy_check_stringified = JSON.stringify(policy_check);
            // console.log(policy_check_stringified);
            resolve(policy_check);
          } else if (error) {
            console.log(error);
            reject(new Error("Unable to create Policy Check."));
          } else {
            reject(new Error("Unable to create Policy Check."));
          }
        } else {
          console.log(error);
          console.error(new Error("Unable to create Policy Check."));
          reject(error);
        }
      }
    );
  });
}

//test autofix
// function getExtension(file) {
//   var extenstion = file.split(".").pop();
//   return extenstion;
// }

// function lint(files, autofix, body) {
//   // var cmd = "which eslint";
//   // // console.log("==== Lint called ===");
//   if (autofix) {
//     var cmd = "eslint --color --fix --format json " + files.join(" ");
//     // console.log("Prepare to fix");
//   } else {
//     var cmd = "eslint --color --format json " + files.join(" ");
//   }
//   try {
//     // // console.log("==== Try ===");
//     var linter_command = execSync(cmd);
//     if (linter_command) {
//       // // console.log("linter_command.toString() WORKS");
//       // console.error(linter_command.toString() );
//       // process.stdout.write(linter_command);
//       // console.log(linter_command.stdout);
//       // console.log(linter_command);
//       var output = JSON.parse(linter_command);
//       // console.log(output)
//       parseOutPoutForRuleCheck(output);
//       prepareRequestAfterLint(true, body, 0, output);
//     }
//   } catch (err) {
//     // // console.log("==== Catch ===");
//     // // console.log(err);
//
//     if (err.stdout) {
//       console.log("==== Catch stdout ===");
//       // console.log(err.stdout.toString());
//       var output = JSON.parse(err.stdout);
//       parseOutPoutForRuleCheck(output);
//       prepareRequestAfterLint(false, body, 1, output);
//
//       // prepareRequestAfterLint(false, body, 1)
//     }
//     // prepareRequestAfterLint(passed, body)
//     //  process.exit(1);
//     // // console.log("==== Catch after ===");
//   }
//   // // console.log("Linting Done");
// }
//

function fetchLinters() {
  var linters = [];

  if (checkIfEslintIsInstalled()) {
    var eslint = {
      name: "eslint",
      language: "Javascript",
      installed: "true",
      command: "npm install -g eslint"
    };
    linters.push(eslint);
  } else {
    var eslint = {
      name: "eslint",
      language: "Javascript",
      installed: "false",
      command: "npm install -g eslint"
    };
    linters.push(eslint);
  }

  if (checkIfRubocopIsInstalled()) {
    var rubocop = {
      name: "rubocop",
      language: "Ruby",
      installed: "true",
      command: "gem install rubocop"
    };
    linters.push(rubocop);
  } else {
    var rubocop = {
      name: "rubocop",
      language: "Ruby",
      installed: "false",
      command: "gem install rubocop"
    };
    linters.push(rubocop);
  }

  if (1 == 0) {
    var phplint = {
      name: "phplint",
      language: "Php",
      installed: "true",
      command: "gem install rubocop"
    };
    linters.push(phplint);
  } else {
    var phplint = {
      name: "phplint",
      language: "Php",
      installed: "false",
      command: "npm install -g eslint"
    };
    linters.push(phplint);
  }

  printLinters(linters);
}

function printLinters(linters) {
  if (linters) {
    var table = new CliTable({
      head: [
        chalk.cyan("Linters (" + linters.length + ")"),
        chalk.cyan("Installed"),
        chalk.cyan("language"),
        chalk.cyan("Command")
      ],
      // colWidths: [30, 45, 12, 12, 12, 16, 16],
      colWidths: [35, 15, 19, 30]
    });
    linters.map(linter => {
      // const url = SITE_URL + '/' + repository.uuid;
      if (linter.installed == "true") {
        var installed = chalk.green(linter.installed);
      } else {
        var installed = chalk.red(linter.installed);
      }
      table.push([linter.name, installed, linter.language, linter.command]);
    });
    console.log(table.toString());
    process.exit(0);
  } else {
    console.log("No Linters.");
    process.exit(1);
  }
}

function preCommit(keep, time) {

  if (checkIfEslintIsInstalled()) {
    // console.log("Eslint is installed.");
  } else {
    console.log("Eslint is not installed. Installing...");
    installEslint();
    console.log("Eslint is now installed.");
  }

  if (checkIfPrettierIsInstalled()) {
    // console.log("Prettier is installed.");
  } else {
    console.log("Prettier is not installed. Installing...");
    installPrettier();
    console.log("Prettier is now installed.");
  }

  if (checkIfRubocopIsInstalled()) {
    // console.log("Rubocop is installed.");
  } else {
    console.log("Rubocop is not installed. Installing...");
    installRubocop();
    console.log("Rubocop is now installed.");
  }

  lintingPreCommit("simple", keep, time);
}

function readPaths() {
  if (fs.existsSync("./.lint/tmp/staged")) {
    const paths = fs
      .readFileSync("./.lint/tmp/staged")
      .toString()
      .split(",");

    // console.log(paths);
    return paths;
  } else {
    console.error("No commit attempt found");
  }
}

function readReport() {
  if (fs.existsSync("./.lint/tmp/report")) {
    try {
      const report = JSON.parse(fs.readFileSync("./.lint/tmp/report"));
      return report;
    } catch (e) {
      console.error("Can't find report file.");
      console.log(e);
    }
  } else {
    console.error("No report found");
  }
}

function checkIfPolicyCheckPassed() {
  var report = readReport();
  if (report !== undefined && !report.passed) {
    console.log("");
    const repositoryUUID = parseLintFile();
    if (!repositoryUUID) {
      console.log(
        "Please init repository first by running " +
          chalk.green("omnilint init") +
          "."
      );
      process.exit(1);
    }
    editCommitAttempt(repositoryUUID).then(body => {
      rimraf("./.lint/tmp/");
      process.exit(1);
    });
  }
}

function prepareCommitMsg() {
  checkIfPolicyCheckPassed();
}

function postCommit() {
  const repositoryUUID = parseLintFile();
  if (!repositoryUUID) {
    console.log(
      "Please init repository first by running " +
        chalk.green("omnilint init") +
        "."
    );
    process.exit(1);
  }
  checkInternet(function(isConnected) {
    // Terminate when no internet access
    if (!isConnected) {
      console.log("Not connected to the Internet.");
      process.exit(1);
    }
    const sha = fetchSHA();

    editCommitAttempt(repositoryUUID, sha)
      .then(body => {
        // console.log(body);
        rimraf("./.lint/tmp/");
      })
      .catch(error => {
        console.log(error);
        process.exit(1);
      });
  });
}

function editCommitAttempt(repositoryUUID, sha) {
  return new Promise((resolve, reject) => {
    if (!sha) {
      const sha = fetchSHA();
    }
    // console.log(sha);
    const currentUser = getUsernameFromLocalDevice();
    const token = getTokenFromLocalDevice();
    // const token = "v5NnNqL3C9bQyrzUfzDxTnmvztPr8PMheTebeF8zr7VKozq1uQ";

    if (!repositoryUUID) {
      reject(new Error("Unable to get repositoryUUID."));
      process.exit(1);
    }
    if (!token) {
      console.log("Please log in first.");
      reject(new Error("Unable to get token."));
      process.exit(1);
    }
    if (fs.existsSync(".git/COMMIT_EDITMSG")) {
      var commitMessage = fs.readFileSync(".git/COMMIT_EDITMSG", "utf8");
    } else {
      var commitMessage = "NO COMMIT MESSAGE";
    }
    //test
    const commit_attempt_id = readCommitAttempId();
    // console.log(commitMessage);
    // console.log(sha);

    const url = `${API_BASE_URL}/${repositoryUUID}/commit_attempts/${commit_attempt_id}.json?user_token=${token}`;
    // console.log(url);
    request.put(
      url,
      {
        json: {
          commit_attempt: {
            message: commitMessage,
            sha: sha
          }
        }
      },
      function(error, response, body) {
        // console.log(url);
        // console.log(response);
        // console.log(body);
        if (response) {
          // console.log(response);
          // console.log(response.statusCode);

          if (
            (!error && response.statusCode == 200) ||
            response.statusCode == 204
          ) {
            // var stringify = JSON.stringify(body);
            resolve(body);
          } else {
            console.log(error);
            console.log(body);
            console.log(response.statusCode);
            reject(new Error("Unable to post to server."));
          }
        } else {
          console.error(new Error("Unable to connect."));
          reject(error);
        }
        reject(error);
      }
    );
  });
}

module.exports = {
  getStagedFiles,
  getDeletedStagedFiles,
  lintingPreCommit,
  createCommitAttempt,
  lintStaged,
  preCommit,
  postCommit,
  prepareCommitMsg,
  // installEslint,
  // getExtension,
  fetchLinters
  // createLintStagedConfig
};
