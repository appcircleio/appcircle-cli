#!/usr/bin/env node
import { readFileSync } from "fs";
import { execFileSync } from "child_process";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
// `versions` alone: the full `npm view --json` is an object on some npm versions and an array on others.
// It is a bare string when only one version is published, hence the concat.
const publishedVersions = [].concat(JSON.parse(execFileSync("npm", ["view", packageJson.name, "versions", "--json"], { encoding: "utf8" })));
if (publishedVersions.includes(packageJson.version)) {
  console.log(`${packageJson.version} version already published!`);
  process.exit(1);
} else {
  console.log(`${packageJson.version} version is available, not previously published.`);
  process.exit(0);
}
