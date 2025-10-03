#!/bin/bash
# Script to update coverage badges locally
# Usage: ./scripts/update-badges-local.sh

set -e

echo "📊 Updating coverage badges locally..."

# Run tests to generate coverage
echo "🧪 Running tests..."
TEST_OUTPUT=$(npm test 2>&1)

# Check if tests passed
if [ $? -ne 0 ]; then
    echo "❌ Tests failed!"
    exit 1
fi

echo "✅ Tests passed!"

# Extract test count
TESTS_PASSED=$(echo "$TEST_OUTPUT" | grep -oP 'Tests\s+\K\d+(?=\s+passed)' | tail -1)

# Generate badges
if [ -n "$TESTS_PASSED" ]; then
    echo "📝 Generating badges with $TESTS_PASSED tests..."
    BADGES=$(node scripts/parse-coverage.js badges "{\"passed\":$TESTS_PASSED}")
else
    echo "📝 Generating badges without test count..."
    BADGES=$(node scripts/parse-coverage.js badges)
fi

echo ""
echo "Generated badges:"
echo "=================================="
echo "$BADGES"
echo "=================================="
echo ""
echo "✨ Copy the badges above and replace lines 2-4 in README.md"
echo ""
echo "Current badges in README.md:"
head -4 README.md | tail -3
