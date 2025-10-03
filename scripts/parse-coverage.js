#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Parses the coverage HTML report and extracts coverage metrics
 * @returns {Object} Coverage metrics including statements, branches, functions, lines
 */
function parseCoverageReport() {
  const coverageHtmlPath = path.join(__dirname, '../coverage/lcov-report/index.html');

  if (!fs.existsSync(coverageHtmlPath)) {
    console.error('Coverage report not found at:', coverageHtmlPath);
    process.exit(1);
  }

  const html = fs.readFileSync(coverageHtmlPath, 'utf-8');

  // Extract overall coverage metrics
  const statementsMatch = html.match(/<span class="strong">(\d+\.?\d*)%\s*<\/span>\s*<span class="quiet">Statements<\/span>\s*<span class='fraction'>(\d+)\/(\d+)<\/span>/);
  const branchesMatch = html.match(/<span class="strong">(\d+\.?\d*)%\s*<\/span>\s*<span class="quiet">Branches<\/span>\s*<span class='fraction'>(\d+)\/(\d+)<\/span>/);
  const functionsMatch = html.match(/<span class="strong">(\d+\.?\d*)%\s*<\/span>\s*<span class="quiet">Functions<\/span>\s*<span class='fraction'>(\d+)\/(\d+)<\/span>/);
  const linesMatch = html.match(/<span class="strong">(\d+\.?\d*)%\s*<\/span>\s*<span class="quiet">Lines<\/span>\s*<span class='fraction'>(\d+)\/(\d+)<\/span>/);

  if (!statementsMatch || !branchesMatch || !functionsMatch || !linesMatch) {
    console.error('Failed to parse coverage metrics from HTML report');
    process.exit(1);
  }

  return {
    statements: {
      pct: parseFloat(statementsMatch[1]),
      covered: parseInt(statementsMatch[2]),
      total: parseInt(statementsMatch[3])
    },
    branches: {
      pct: parseFloat(branchesMatch[1]),
      covered: parseInt(branchesMatch[2]),
      total: parseInt(branchesMatch[3])
    },
    functions: {
      pct: parseFloat(functionsMatch[1]),
      covered: parseInt(functionsMatch[2]),
      total: parseInt(functionsMatch[3])
    },
    lines: {
      pct: parseFloat(linesMatch[1]),
      covered: parseInt(linesMatch[2]),
      total: parseInt(linesMatch[3])
    }
  };
}

/**
 * Gets the badge color based on coverage percentage
 * @param {number} pct - Coverage percentage
 * @returns {string} Badge color
 */
function getBadgeColor(pct) {
  if (pct >= 80) return 'brightgreen';
  if (pct >= 60) return 'yellow';
  return 'red';
}

/**
 * Gets the emoji status based on coverage percentage
 * @param {number} pct - Coverage percentage
 * @returns {string} Status emoji
 */
function getStatusEmoji(pct) {
  if (pct >= 80) return '🟢';
  if (pct >= 60) return '🟡';
  return '🔴';
}

/**
 * Generates markdown badges for README
 * @param {Object} coverage - Coverage metrics
 * @returns {string} Markdown badges
 */
function generateBadges(coverage) {
  const overallColor = getBadgeColor(coverage.statements.pct);
  const branchesColor = getBadgeColor(coverage.branches.pct);
  const functionsColor = getBadgeColor(coverage.functions.pct);

  return [
    `![Coverage](https://img.shields.io/badge/coverage-${coverage.statements.pct}%25-${overallColor})`,
    `![Branches](https://img.shields.io/badge/branches-${coverage.branches.pct}%25-${branchesColor})`,
    `![Functions](https://img.shields.io/badge/functions-${coverage.functions.pct}%25-${functionsColor})`
  ].join('\n');
}

/**
 * Reads coverage thresholds from vitest.config.ts
 * @returns {Object|null} Threshold values
 */
function readThresholds() {
  const configPath = path.join(__dirname, '../vitest.config.ts');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  const config = fs.readFileSync(configPath, 'utf-8');

  // Extract global thresholds
  const thresholdsMatch = config.match(/global:\s*\{[^}]*branches:\s*(\d+)[^}]*functions:\s*(\d+)[^}]*lines:\s*(\d+)[^}]*statements:\s*(\d+)/s);

  if (thresholdsMatch) {
    return {
      branches: parseInt(thresholdsMatch[1]),
      functions: parseInt(thresholdsMatch[2]),
      lines: parseInt(thresholdsMatch[3]),
      statements: parseInt(thresholdsMatch[4])
    };
  }

  return null;
}

/**
 * Checks if metric passes threshold
 * @param {number} pct - Coverage percentage
 * @param {number} threshold - Threshold value
 * @returns {string} Status emoji
 */
function getThresholdStatus(pct, threshold) {
  return pct >= threshold ? '✅' : '❌';
}

/**
 * Generates a PR comment with coverage details and thresholds
 * @param {Object} coverage - Coverage metrics
 * @returns {string} Markdown comment
 */
function generatePRComment(coverage) {
  const thresholds = readThresholds();

  let comment = `## 📊 Coverage Report\n\n`;

  // Coverage table with thresholds
  comment += `| Metric | Coverage | Threshold | Status |\n`;
  comment += `|--------|----------|-----------|--------|\n`;

  const metrics = [
    { key: 'statements', label: 'Statements' },
    { key: 'branches', label: 'Branches' },
    { key: 'functions', label: 'Functions' },
    { key: 'lines', label: 'Lines' }
  ];

  metrics.forEach(({ key, label }) => {
    const current = coverage[key].pct;
    const threshold = thresholds ? thresholds[key] : null;
    const thresholdStr = threshold ? `${threshold}%` : '-';
    const status = threshold ? getThresholdStatus(current, threshold) : getStatusEmoji(current);

    comment += `| ${label} | ${current}% (${coverage[key].covered}/${coverage[key].total}) | `;
    comment += `${thresholdStr} | ${status} |\n`;
  });

  comment += `\n`;

  // Show threshold failures
  if (thresholds) {
    const failures = [];
    metrics.forEach(({ key, label }) => {
      if (coverage[key].pct < thresholds[key]) {
        failures.push({ label, current: coverage[key].pct, threshold: thresholds[key] });
      }
    });

    if (failures.length > 0) {
      comment += `### ⚠️ Coverage Below Threshold\n\n`;
      failures.forEach(({ label, current, threshold }) => {
        comment += `- ❌ ${label}: ${current}% < ${threshold}%\n`;
      });
      comment += `\n**This PR cannot be merged until coverage meets the minimum thresholds.**\n\n`;
    }
  }

  comment += `### Legend\n`;
  comment += `✅ Passing | ❌ Failing\n\n`;
  comment += `---\n`;
  comment += `*Generated by Appcircle CLI Coverage Reporter*`;

  return comment;
}

/**
 * Checks if coverage meets all thresholds
 * @param {Object} coverage - Coverage metrics
 * @returns {boolean} True if all thresholds are met
 */
function checkCoverageThresholds(coverage) {
  const thresholds = readThresholds();

  if (!thresholds) {
    console.error('No thresholds found in vitest.config.ts');
    return true; // Pass if no thresholds defined
  }

  const failures = [];
  const metrics = ['statements', 'branches', 'functions', 'lines'];

  metrics.forEach(metric => {
    if (coverage[metric].pct < thresholds[metric]) {
      failures.push(`${metric}: ${coverage[metric].pct}% < ${thresholds[metric]}%`);
    }
  });

  if (failures.length > 0) {
    console.error('Coverage below threshold:');
    failures.forEach(failure => console.error(`  ❌ ${failure}`));
    return false;
  }

  console.log('✅ All coverage thresholds met');
  return true;
}

// Main execution
function main() {
  const command = process.argv[2];

  if (!command) {
    console.error('Usage: node parse-coverage.js [badges|pr-comment|json]');
    process.exit(1);
  }

  const coverage = parseCoverageReport();

  switch (command) {
    case 'badges':
      console.log(generateBadges(coverage));
      break;
    case 'pr-comment':
      console.log(generatePRComment(coverage));
      break;
    case 'json':
      console.log(JSON.stringify(coverage, null, 2));
      break;
    case 'check-threshold':
      const passed = checkCoverageThresholds(coverage);
      process.exit(passed ? 0 : 1);
      break;
    default:
      console.error('Unknown command:', command);
      console.error('Available commands: badges, pr-comment, json, check-threshold');
      process.exit(1);
  }
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseCoverageReport,
    getBadgeColor,
    getStatusEmoji,
    generateBadges,
    generatePRComment,
    readThresholds,
    checkCoverageThresholds
  };
}

// Run main if executed directly
if (require.main === module) {
  main();
}
