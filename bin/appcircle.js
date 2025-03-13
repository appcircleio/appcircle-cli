#!/usr/bin/env node

try {
  require('../dist/main.js');
} catch (err) {
  console.error('Error loading the CLI:', err);
  process.exit(1);
}