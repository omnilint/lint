const fs = require("fs");
var path = require("path");
const chalk = require("chalk");
const { prompt } = require("inquirer");
const { exec, execSync, spawn } = require("child_process");
const { init } = require("./initializer");
const {
  getEnclosingGitRepository,
  isOmnilintFilePresent,
  isLocalInstall,
  getDotOmnilintDirectory,
  rimraf
} = require("./filesHandler");
const {
  checkIfEslintIsInstalled,
  installEslint
} = require('./linters/eslint');
const {
  checkIfRubocopIsInstalled,
  installRubocop
} = require('./linters/rubocop');
const {
  checkIfPrettierIsInstalled,
  installPrettier
} = require('./linters/prettier');


const {
  checkIfStyleLintIsInstalled,
  installStyleLint
} = require('./linters/stylelint');

const {
  checkForPyLintRequirement
} = require('./linters/pylint');

const {
  installErbLint,
  checkIfErbLintIsInstalled
} = require('./linters/erbLint');

var momentjs = require("moment");

// let hooksDirectory = getHooksDirectory();
function install() {
  const moment = momentjs();
  const enclosingGitRepository = getEnclosingGitRepository();


  if(checkIfEslintIsInstalled()) {
    console.log("Eslint is installed.")
  } else {
    console.log("ESLint is not installed. Installing...")
    installEslint();
    console.log("ESLint is now installed.")
  }


  if(checkIfPrettierIsInstalled()) {
    console.log("Prettier is installed.")
  } else {
    console.log("Prettier is not installed. Installing...")
    installPrettier();
    console.log("Prettier is now installed.")
  }

  if(checkIfRubocopIsInstalled()) {
    console.log("Rubocop is installed.")
  } else {
    console.log("Rubocop is not installed. Installing...")
    installRubocop();
    console.log("Rubocop is now installed.")
  }


  if(checkIfErbLintIsInstalled()) {
    console.log("ERBLint is installed.")
  } else {
    console.log("ERBLint is not installed. Installing...")
    installErbLint();
    console.log("ERBLint is now installed.")
  }

  if(checkIfStyleLintIsInstalled()) {
    console.log("StyleLint is installed.")
  } else {
    console.log("StyleLint is not installed. Installing...")
    installStyleLint();
    console.log("StyleLint is now installed.")
  }

  checkForPyLintRequirement()

  if (
    !enclosingGitRepository ||
    enclosingGitRepository == "" ||
    enclosingGitRepository == " "
  ) {
    console.log();
    console.log("Can't find .git, skipping Git hooks installation");
    console.log(
      "Please check that you're in a cloned repository or run 'git init' to create an empty Git repository and reinstall omnilint"
    );
    console.log();
    process.exit(0);
  }



  if (fs.existsSync(enclosingGitRepository)) {
    if (
      !fs.existsSync(
        enclosingGitRepository +
          "/.git/hooks_backup_" +
          moment.format("YYYY-MM-DD_HH:mm:ss")
      )
    ) {
      fs.mkdirSync(
        enclosingGitRepository +
          "/.git/hooks_backup_" +
          moment.format("YYYY-MM-DD_HH:mm:ss")
      );
      copyFolderRecursiveSync(
        enclosingGitRepository + "/.git/hooks",
        enclosingGitRepository +
          "/.git/hooks_backup_" +
          moment.format("YYYY-MM-DD_HH:mm:ss")
      );
    }
  } else {
    fs.mkdirSync(enclosingGitRepository + "/hooks");
  }

  const hooksCreated = createHooks();
  if (!hooksCreated) {
    process.exit(0);
  }

  if (!isOmnilintFilePresent()) {
    init();
  } else {
    process.exit(0);
  }
}

function removeOmnilintHook(hooksDirectory, hook) {
  if (!fs.existsSync(hooksDirectory + hook)) {
    console.log(hook + " not found");
    return false;
  }

  const enclosingGitRepository = getEnclosingGitRepository();
  if (
    !enclosingGitRepository ||
    enclosingGitRepository == "" ||
    enclosingGitRepository == " "
  ) {
    console.log();
    console.log("Can't find .git, skipping Git hooks removal");
    console.log(
      "Please check that you're in a cloned repository or run 'git init' to create an empty Git repository and reinstall omnilint"
    );
    console.log();
    return false;
  }
  if (fs.existsSync(enclosingGitRepository)) {
    fs.unlinkSync(hooksDirectory + hook);
    console.log(chalk.yellow(hook) + " deleted");
    return true;
  }
}

function removeOmnilintDirectory() {
  const dotOmnilintDirectory = getDotOmnilintDirectory();
  rimraf(dotOmnilintDirectory);
}

function uninstall() {
  let hooksDirectory = getHooksDirectory();
  if (!hooksDirectory) {
    console.log("No hook directory to delete");
    process.exit(0);
  }

  var removedPreCommit = removeOmnilintHook(hooksDirectory, "/pre-commit");
  var removedPrepareCommitMsg = removeOmnilintHook( hooksDirectory, "/prepare-commit-msg" );
  var removedPostCommit = removeOmnilintHook(hooksDirectory, "/post-commit");

  if (!removedPrepareCommitMsg || !removedPostCommit) {
    console.log("Something went wrong");
    process.exit(1);
  } else {
    process.exit(0);
  }
}

function getHooksDirectory() {
  var enclosingGitRepository = getEnclosingGitRepository();
  if (
    !enclosingGitRepository ||
    enclosingGitRepository == "" ||
    enclosingGitRepository == " "
  ) {
    return false;
  }
  return enclosingGitRepository + "/.git/hooks";
}

function formatPreCommitMsgHook() {
  let hook =
    '#!/bin/bash\n\nlocalPath="./node_modules/omnilint/omnilint"\nglobalPath=$(which omnilint)\ngitParams="$*"\n\nif [ -a $localPath ]; then\n\t$localPath "pre-commit"\nelif [ $globalPath ]; then\n\t$globalPath "pre-commit"\nelse\n\techo "Can\'t find Omnilint, skipping hook"\n\techo "You can reinstall it using \'npm install omnilint --save-dev\' or delete this hook"\nfi\n';
  // let hook = '#!/bin/bash\n\nlocalPath="./node_modules/omnilint/omnilint"\nglobalPath=$(which omnilint)\ngitParams="$*"\nif [ -a $localPath ]; then\n$localPath "lint-staged" "-f" "simple"\nelif [ $globalPath ]; then\n$globalPath "lint-staged" "-f" "simple"\nelse\necho "Can\'t find Omnilint, skipping hook"\necho "You can reinstall it using \'npm install omnilint --save-dev\' or delete this hook\"\nfi\n';
  return hook;
}

function formatPrepareCommitMsgHook() {
  let hook =
    '#!/bin/bash\n\nlocalPath="./node_modules/omnilint/omnilint"\nglobalPath=$(which omnilint)\ngitParams="$*"\n\nif [ -a $localPath ]; then\n\t$localPath "prepare-commit-msg"\nelif [ $globalPath ]; then\n\t$globalPath "prepare-commit-msg"\nelse\n\techo "Can\'t find Omnilint, skipping hook"\n\techo "You can reinstall it using \'npm install omnilint --save-dev\' or delete this hook"\nfi\n';
  // let hook = '#!/bin/bash\n\nlocalPath="./node_modules/omnilint/omnilint"\nglobalPath=$(which omnilint)\ngitParams="$*"\nif [ -a $localPath ]; then\n$localPath "lint-staged" "-f" "simple"\nelif [ $globalPath ]; then\n$globalPath "lint-staged" "-f" "simple"\nelse\necho "Can\'t find Omnilint, skipping hook"\necho "You can reinstall it using \'npm install omnilint --save-dev\' or delete this hook\"\nfi\n';
  return hook;
}

function formatPostCommitHook() {
  let hook =
    '#!/bin/bash\n\nlocalPath="./node_modules/omnilint/omnilint"\nglobalPath=$(which omnilint)\ngitParams="$*"\n\nif [ -f $localPath ]; then\n\t$localPath "post-commit" "$gitParams"\nelif [ $globalPath ]; then\n\t$globalPath "post-commit" "$gitParams"\nelse\n\techo "Can\'t find Omnilint, skipping hook"\n\techo "You can reinstall it using \'npm install omnilint --save-dev\' or delete this hook"\nfi\n';
  return hook;
}


function createHooks() {
  // let hook = "#!/bin/bash\nnode index.js lint-staged";
  // console.log("Good here");
  let preCommit = formatPreCommitMsgHook();
  let prepareCommitMsg = formatPrepareCommitMsgHook();
  let postCommit = formatPostCommitHook();
  // console.log("before hook");
  // console.log(hook);
  // console.log("after hook");

  let hooksDirectory = getHooksDirectory();
  if (!hooksDirectory) {
    return false;
  }
  fs.writeFileSync(hooksDirectory + "/pre-commit", preCommit);
  fs.writeFileSync(hooksDirectory + "/prepare-commit-msg", prepareCommitMsg);
  fs.writeFileSync(hooksDirectory + "/post-commit", postCommit);
  makeHookExecutable(hooksDirectory, "/prepare-commit-msg");
  makeHookExecutable(hooksDirectory, "/post-commit");
  makeHookExecutable(hooksDirectory, "/pre-commit");
  return true;
}

function makeHookExecutable(hooksDirectory, hookName) {
  try {

    var hookPath = hooksDirectory + hookName;
    // console.log(hookPath);
    var res = execSync("chmod +x " + hookPath);
    if (res) {
      // console.log("Hook saved successfully to: " + chalk.green(hookPath));
      console.log("Hook saved successfully to: " + chalk.green(".git/hooks"+hookName));


    }
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
}

function copyFileSync(source, target) {
  var targetFile = target;

  //if target is a directory a new file with the same name will be created
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isDirectory()) {
      targetFile = path.join(target, path.basename(source));
    }
  }

  fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync(source, target) {
  var files = [];

  //check if folder needs to be created or integrated
  var targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder);
  }
  console.log("Saving your hooks to " + targetFolder);
  //copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach(function(file) {
      var curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        copyFileSync(curSource, targetFolder);
      }
    });
  }
}

module.exports = { install, uninstall };
