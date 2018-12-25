const fs = require("fs");
var path = require("path");
const chalk = require("chalk");
const { exec, execSync, spawn } = require("child_process");
const yaml = require("js-yaml");

const dotOmnilintDirectory = getDotOmnilintDirectory();

function getEnclosingGitRepository() {
  var gitRepository = "./.git";

  if (!fs.existsSync(gitRepository)) {
    gitRepository = "../.git";
    if (!fs.existsSync(gitRepository)) {
      gitRepository = "../../.git";
      if (!fs.existsSync(gitRepository)) {
        gitRepository = "../../../.git";
        if (!fs.existsSync(gitRepository)) {
          gitRepository = "../../../../.git";
          if (!fs.existsSync(gitRepository)) {
            // gitRepository = " ";
            return false;
          }
        }
      }
    }
  }
  if (gitRepository && gitRepository.length >= 5) {
    gitRepository = gitRepository.substring(0, gitRepository.length - 5);
  }
  return gitRepository;
}

function isLocalInstall() {
  const binaryPath = process.execPath;
  if (
    binaryPath.indexOf("lib/node_modules") == -1 &&
    binaryPath.indexOf("node_modules") != -1
  ) {
    return true;
  } else {
    return false;
  }
}

function isOmnilintFilePresent() {
  if (
    fs.existsSync(dotOmnilintDirectory) &&
    fs.existsSync(dotOmnilintDirectory + "/config")
  ) {
    return true;
  } else {
    return false;
  }
}

function rimraf(dir_path) {
  if (fs.existsSync(dir_path)) {
    fs.readdirSync(dir_path).forEach(function(entry) {
      var entry_path = path.join(dir_path, entry);
      if (fs.lstatSync(entry_path).isDirectory()) {
        rimraf(entry_path);
      } else {
        fs.unlinkSync(entry_path);
      }
    });
    fs.rmdirSync(dir_path);
  }
}

function getDotOmnilintDirectory() {
  // console.log(getEnclosingGitRepository());
  var enclosingGitRepository = getEnclosingGitRepository();
  if (!enclosingGitRepository) {
    // console.log("No ./git directory found");
    // console.log("You are not in a git repository.");
    return false;
  } else {
    var dotOmnilintDirectory = enclosingGitRepository + "/.omnilint";
  }
  return dotOmnilintDirectory;
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
  console.log("targetFolder");
  console.log(targetFolder);
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder);
  } //copy
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

function copyRecursiveSync(source, target) {
  var exists = fs.existsSync(source);
  var stats = exists && fs.statSync(source);
  var isDirectory = exists && stats.isDirectory();
  if (exists && isDirectory) {
    fs.mkdirSync(target);
    fs.readdirSync(source).forEach(function(childItemName) {
      copyRecursiveSync(
        path.join(source, childItemName),
        path.join(source, childItemName)
      );
    });
  } else {
    fs.linkSync(source, target);
  }
}


function parseOmnilintFile() {
  if (isOmnilintFilePresent()) {
    const repo = yaml.safeLoad(fs.readFileSync(dotOmnilintDirectory + "/config"));
    return repo;
  }
}

module.exports = {
  getEnclosingGitRepository,
  isOmnilintFilePresent,
  getDotOmnilintDirectory,
  isLocalInstall,
  rimraf,
  copyFileSync,
  copyFolderRecursiveSync,
  copyRecursiveSync,
  parseOmnilintFile
};