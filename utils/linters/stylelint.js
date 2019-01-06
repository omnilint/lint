const fs = require("fs");
const { exec, execSync, spawn } = require("child_process");

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


module.exports = {
  checkIfStyleLintIsInstalled,
  installStyleLint
}
