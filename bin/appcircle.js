#!/usr/bin/env node

// npm only warns on `engines`; without this an older Node fails with ERR_REQUIRE_ESM on chalk/ora/conf.
// 22.13, not 22.12: 22.12.0 prints a require(esm) ExperimentalWarning.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major > 22 || (major === 22 && minor >= 13)) {
  try {
    require('../dist/main.js');
  } catch (err) {
    console.error('Error loading the CLI:', err);
    process.exit(1);
  }
} else {
  console.error(`Appcircle CLI requires Node.js 22.13 or later; this is ${process.version}.`);
  process.exit(1);
}
