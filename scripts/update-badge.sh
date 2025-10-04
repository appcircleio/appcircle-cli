#!/bin/bash
set -e

# Load environment variables from .env file
[ -f .env ] && source .env

# Configuration
REPO="appcircleio/appcircle-cli"
BASE_BRANCH="develop"
GIT_USER_EMAIL="ozer@appcircle.io"
GIT_USER_NAME="Özer from Jenkins"

echo "🤖 Starting coverage badge update script..."

# Functions
die() {
    echo "⚠️  $1"
    [ -f "$PROJECT_ROOT/README.md.bak" ] && mv "$PROJECT_ROOT/README.md.bak" "$PROJECT_ROOT/README.md"
    exit 0
}

api_call() {
    local method=$1
    local endpoint=$2
    local data=$3

    curl -s -X "$method" \
        -H "Authorization: token ${GITHUB_PAT}" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        ${data:+-d "$data"} \
        "https://api.github.com/repos/${REPO}/${endpoint}"
}

# Main script
echo "📊 Updating coverage badges in README..."

# Get the project root directory (parent of scripts/)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Install dependencies if needed
[ ! -d "node_modules" ] && yarn install

# Run tests
echo "🧪 Running tests to generate coverage..."
TEST_OUTPUT=$(npm test 2>&1) || die "Tests failed, skipping badge update"

# Extract test count and generate badges
TESTS_PASSED=$(echo "$TEST_OUTPUT" | grep -oE 'Tests[[:space:]]+[0-9]+[[:space:]]+passed' | grep -oE '[0-9]+' | head -1)
if [ -n "$TESTS_PASSED" ]; then
    BADGES=$(node "$PROJECT_ROOT/scripts/parse-coverage.js" badges "{\"passed\":$TESTS_PASSED}" 2>/dev/null) || die "Failed to generate badges"
else
    BADGES=$(node "$PROJECT_ROOT/scripts/parse-coverage.js" badges 2>/dev/null) || die "Failed to generate badges"
fi

echo "Generated badges:"
echo "$BADGES"

# Update README
grep -q "^!\\[Coverage\\]" "$PROJECT_ROOT/README.md" || die "Coverage badge not found in README.md"

cp "$PROJECT_ROOT/README.md" "$PROJECT_ROOT/README.md.bak"
grep -v "^!\\[Coverage\\]\\|^!\\[Build\\]\\|^!\\[Tests\\]\\|^!\\[Branches\\]\\|^!\\[Functions\\]" "$PROJECT_ROOT/README.md" > "$PROJECT_ROOT/README.md.tmp"

LINE_NUM=$(grep -n "^!\\[NPM Version\\]" "$PROJECT_ROOT/README.md.tmp" | cut -d: -f1)
if [ -n "$LINE_NUM" ]; then
    { head -n "$LINE_NUM" "$PROJECT_ROOT/README.md.tmp"; echo "$BADGES"; tail -n +$((LINE_NUM + 1)) "$PROJECT_ROOT/README.md.tmp"; } > "$PROJECT_ROOT/README.md"
else
    { echo "$BADGES"; echo ""; cat "$PROJECT_ROOT/README.md.tmp"; } > "$PROJECT_ROOT/README.md"
fi
rm -f "$PROJECT_ROOT/README.md.tmp"

# Check for changes
if git diff --quiet "$PROJECT_ROOT/README.md"; then
    echo "ℹ️  No changes to coverage badges"
    rm -f "$PROJECT_ROOT/README.md.bak"
    exit 0
fi

# Configure git and create PR
git config user.email "$GIT_USER_EMAIL"
git config user.name "$GIT_USER_NAME"

BRANCH_NAME="coverage-badges-$(date +%Y%m%d-%H%M%S)"
echo "📝 Creating branch: $BRANCH_NAME"

git checkout -b "$BRANCH_NAME" || die "Failed to create branch"
git add "$PROJECT_ROOT/README.md"
git commit -m "docs: update coverage badges [skip ci]" || die "Failed to commit changes"

echo "📤 Pushing branch to remote..."
git push "https://${GITHUB_PAT}@github.com/${REPO}.git" "$BRANCH_NAME" || die "Failed to push branch"

echo "🔀 Creating pull request..."
PR_RESPONSE=$(api_call POST pulls "{\"title\":\"docs: update coverage badges [skip ci]\",\"body\":\"🤖 Automated coverage badge update from Jenkins build #${BUILD_NUMBER}\",\"head\":\"$BRANCH_NAME\",\"base\":\"$BASE_BRANCH\"}")

# Extract PR number from response
PR_NUMBER=$(echo "$PR_RESPONSE" | sed -n 's/.*"number":[[:space:]]*\([0-9]*\).*/\1/p' | head -1)

if [ -z "$PR_NUMBER" ]; then
    echo "⚠️  Failed to create PR"
    echo "Response: $PR_RESPONSE"
    die "Could not extract PR number from response"
fi

echo "✅ Created PR #${PR_NUMBER}: https://github.com/${REPO}/pull/${PR_NUMBER}"
echo "🚀 Attempting to merge PR #${PR_NUMBER}..."

MERGE_RESPONSE=$(api_call PUT "pulls/${PR_NUMBER}/merge" '{"merge_method":"squash"}')
if echo "$MERGE_RESPONSE" | grep -q '"merged":true'; then
    echo "✅ PR #${PR_NUMBER} merged successfully"
    api_call DELETE "git/refs/heads/$BRANCH_NAME" > /dev/null
    rm -f "$PROJECT_ROOT/README.md.bak"
else
    echo "⚠️  Could not auto-merge PR #${PR_NUMBER}"
    echo "💡 This may be due to:"
    echo "   - Branch protection rules requiring reviews"
    echo "   - Insufficient permissions on the PAT"
    echo "   - Required status checks not passing"
    echo ""
    echo "📋 PR is open and waiting for manual review/merge:"
    echo "   https://github.com/${REPO}/pull/${PR_NUMBER}"
    echo ""
    echo "Response: $MERGE_RESPONSE"
    rm -f "$PROJECT_ROOT/README.md.bak"
fi

exit 0