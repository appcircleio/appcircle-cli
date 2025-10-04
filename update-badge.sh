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
echo "Repository: $GITHUB_PAT"

# Functions
die() {
    echo "⚠️  $1"
    [ -f README.md.bak ] && mv README.md.bak README.md
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

# Install dependencies if needed
[ ! -d "node_modules" ] && yarn install

# Run tests
echo "🧪 Running tests to generate coverage..."
TEST_OUTPUT=$(npm test 2>&1) || die "Tests failed, skipping badge update"

# Extract test count and generate badges
TESTS_PASSED=$(echo "$TEST_OUTPUT" | grep -oE 'Tests[[:space:]]+[0-9]+[[:space:]]+passed' | grep -oE '[0-9]+' | head -1)
BADGES=$(node scripts/parse-coverage.js badges ${TESTS_PASSED:+"{\"passed\":$TESTS_PASSED}"} 2>/dev/null) || die "Failed to generate badges"

echo "Generated badges:"
echo "$BADGES"

# Update README
grep -q "^!\\[Coverage\\]" README.md || die "Coverage badge not found in README.md"

cp README.md README.md.bak
grep -v "^!\\[Coverage\\]\\|^!\\[Build\\]\\|^!\\[Tests\\]\\|^!\\[Branches\\]\\|^!\\[Functions\\]" README.md > README.md.tmp

LINE_NUM=$(grep -n "^!\\[NPM Version\\]" README.md.tmp | cut -d: -f1)
if [ -n "$LINE_NUM" ]; then
    { head -n "$LINE_NUM" README.md.tmp; echo "$BADGES"; tail -n +$((LINE_NUM + 1)) README.md.tmp; } > README.md
else
    { echo "$BADGES"; echo ""; cat README.md.tmp; } > README.md
fi
rm -f README.md.tmp

# Check for changes
if git diff --quiet README.md; then
    echo "ℹ️  No changes to coverage badges"
    rm -f README.md.bak
    exit 0
fi

# Configure git and create PR
git config user.email "$GIT_USER_EMAIL"
git config user.name "$GIT_USER_NAME"

BRANCH_NAME="coverage-badges-$(date +%Y%m%d-%H%M%S)"
echo "📝 Creating branch: $BRANCH_NAME"

git checkout -b "$BRANCH_NAME" || die "Failed to create branch"
git add README.md
git commit -m "docs: update coverage badges [skip ci]" || die "Failed to commit changes"

echo "📤 Pushing branch to remote..."
git push "https://${GITHUB_PAT}@github.com/${REPO}.git" "$BRANCH_NAME" || die "Failed to push branch"

echo "🔀 Creating and merging pull request..."
PR_RESPONSE=$(api_call POST pulls "{\"title\":\"docs: update coverage badges [skip ci]\",\"body\":\"🤖 Automated coverage badge update from Jenkins build #${BUILD_NUMBER}\",\"head\":\"$BRANCH_NAME\",\"base\":\"$BASE_BRANCH\"}")
PR_NUMBER=$(echo "$PR_RESPONSE" | grep -o '"number":[0-9]*' | head -1 | cut -d':' -f2)

[ -z "$PR_NUMBER" ] && die "Failed to create PR: $PR_RESPONSE"

echo "✅ Created PR #${PR_NUMBER}"
echo "🚀 Merging PR #${PR_NUMBER}..."

MERGE_RESPONSE=$(api_call PUT "pulls/${PR_NUMBER}/merge" '{"merge_method":"squash"}')
if echo "$MERGE_RESPONSE" | grep -q '"merged":true'; then
    echo "✅ PR #${PR_NUMBER} merged successfully"
    api_call DELETE "git/refs/heads/$BRANCH_NAME" > /dev/null
    rm -f README.md.bak
else
    echo "⚠️  Failed to merge PR #${PR_NUMBER}"
    echo "Response: $MERGE_RESPONSE"
    echo "💡 PR is open at: https://github.com/${REPO}/pull/${PR_NUMBER}"
    mv README.md.bak README.md
fi

exit 0