#!/usr/bin/env zx

const packageJson = require("../package.json");
const npmPackageInfo = JSON.parse((await $`npm view ${packageJson.name} --json`).stdout);
if (npmPackageInfo.versions.includes(packageJson.version)) {
  console.log(`${packageJson.version} version already published!`);
  process.exit(1);
} else {
  console.log(`${packageJson.version} version is available, not previously published.`);
  process.exit(0);
}
