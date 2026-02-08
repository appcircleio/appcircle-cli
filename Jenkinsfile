pipeline {
    agent { label 'agent'}
    parameters {
        booleanParam(name: 'PUBLISH', defaultValue: false, description: 'Trigger publish stage')
    }
    environment {
        NPM_AUTH_TOKEN = credentials('Appcircle-CLI-NPM-Cred')
        GITHUB_PAT = credentials('appcircle-cli-gh-repo-fg-pat')
    }
    stages {
        stage('PR Validation') {
            when {
                changeRequest()
            }
            steps {
                withCredentials([string(credentialsId: 'GithubPersonalToken', variable: 'GITHUB_TOKEN')]) {
                    sh '''#!/bin/bash
                # shellcheck shell=bash
                set -x
                set -euo pipefail
                
                echo "🔨 Starting PR Validation Pipeline 🔨"
                echo "=================================="
                
                echo "📦 Installing dependencies.. ."
                yarn install
                
                echo "⚙️  Running TypeScript compilation..."
                if ! npm run build; then
                    echo "❌ TypeScript compilation failed! 😢"
                    exit 1
                fi
                echo "✅ TypeScript compilation successful! 🎉"
                
                echo "🧪 Running unit tests with coverage..."
                if ! npm test; then
                    echo "❌ Unit tests failed! 💔"
                    exit 1
                fi
                echo "✅ Unit tests passed! 🌟"

                echo "📊 Checking coverage thresholds..."
                if ! node scripts/parse-coverage.js check-threshold; then
                    echo "❌ Coverage below minimum thresholds! 💔"
                    echo "⚠️  This PR cannot be merged until coverage meets the requirements."
                    exit 1
                fi
                echo "✅ Coverage thresholds met! 🎯"

                echo "📊 Posting coverage report to PR..."
                # This section is optional and won't fail the build
                set +e  # Don't exit on error for coverage posting
                if [ -n "${GITHUB_TOKEN:-}" ]; then
                    # Generate PR comment
                    COVERAGE_COMMENT=$(node scripts/parse-coverage.js pr-comment 2>/dev/null)

                    if [ $? -eq 0 ] && [ -n "$COVERAGE_COMMENT" ]; then
                        # Create JSON payload
                        JSON_PAYLOAD=$(jq -n --arg body "$COVERAGE_COMMENT" '{body: $body}' 2>/dev/null)

                        if [ $? -eq 0 ] && [ -n "$JSON_PAYLOAD" ]; then
                            # Post comment to PR
                            HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/gh_response.json -X POST \
                              -H "Authorization: token ${GITHUB_TOKEN}" \
                              -H "Accept: application/vnd.github.v3+json" \
                              -H "Content-Type: application/json" \
                              "https://api.github.com/repos/appcircleio/appcircle-cli/issues/${CHANGE_ID}/comments" \
                              -d "$JSON_PAYLOAD" 2>/dev/null)

                            if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
                                echo "✅ Coverage comment posted to PR #${CHANGE_ID}"
                            else
                                echo "⚠️  Failed to post coverage comment (HTTP ${HTTP_CODE:-unknown}), continuing..."
                                cat /tmp/gh_response.json 2>/dev/null || true
                            fi
                        else
                            echo "⚠️  Failed to create JSON payload, continuing..."
                        fi
                    else
                        echo "⚠️  Failed to generate coverage comment, continuing..."
                    fi
                else
                    echo "⚠️  GITHUB_TOKEN not available, skipping coverage comment"
                fi
                set -e  # Re-enable exit on error

                echo "=================================="
                echo "🎯 PR validation complete - All checks passed! 🚀"
                '''
                }
            }
        }

        stage('Update Coverage Badges') {
            when {
                allOf {
                    branch 'develop'
                    not { changelog '.*\\[skip ci\\].*' }
                }
            }
            steps {
                sh '''#!/bin/bash
                # shellcheck shell=bash
                set -e

                echo "🚀 Testing badge update automation..."

                # Configuration
                REPO="appcircleio/appcircle-cli"
                BASE_BRANCH="develop"
                GIT_USER_EMAIL="ozer@appcircle.io"
                GIT_USER_NAME="Özer from Jenkins"

                echo "🤖 Starting coverage badge update script..."

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

                    curl -s -X "$method" \\
                        -H "Authorization: token ${GITHUB_PAT}" \\
                        -H "Accept: application/vnd.github+json" \\
                        -H "X-GitHub-Api-Version: 2022-11-28" \\
                        ${data:+-d "$data"} \\
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
                if [ -n "$TESTS_PASSED" ]; then
                    BADGES=$(node scripts/parse-coverage.js badges "{\\"passed\\":$TESTS_PASSED}" 2>/dev/null) || die "Failed to generate badges"
                else
                    BADGES=$(node scripts/parse-coverage.js badges 2>/dev/null) || die "Failed to generate badges"
                fi

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

                echo "🔀 Creating pull request..."
                PR_RESPONSE=$(api_call POST pulls "{\\"title\\":\\"docs: update coverage badges [skip ci]\\",\\"body\\":\\"🤖 Automated coverage badge update from Jenkins build #${BUILD_NUMBER}\\",\\"head\\":\\"$BRANCH_NAME\\",\\"base\\":\\"$BASE_BRANCH\\"}")

                # Extract PR number from response
                PR_NUMBER=$(echo "$PR_RESPONSE" | sed -n 's/.*"number":[[:space:]]*\\([0-9]*\\).*/\\1/p' | head -1)

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
                    rm -f README.md.bak
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
                    rm -f README.md.bak
                fi

                exit 0
                '''
            }
        }

        stage('Publish') {
            when {
                anyOf {
                    expression { params.PUBLISH == true }
                    buildingTag()
                }
            }
            steps {
                sh '''#!/bin/bash
                # shellcheck shell=bash
                set -x
                set -euo pipefail

                node --version
                
                git fetch --tags --force
                tag=$(git describe --tags --abbrev=0)
                echo "Tag: ${tag}"

                npmPublishCommand=""
                if [[ "${tag}" == *"beta"* ]]; then
                    echo "Beta Release"
                    npmPublishCommand="npm publish --tag beta"
                elif [[ "${tag}" == *"alpha"* ]]; then
                    echo "Alpha Release"
                    npmPublishCommand="npm publish --tag alpha"
                else
                    echo "Production Release"
                    npmPublishCommand="npm publish"
                fi

                ## Build the image and make it ready for publishing.
                docker image build -t ac-cli .

                ## Publish the application.
                publishStatus=0
                # shellcheck disable=SC2086
                if ! docker run --rm --env NPM_AUTH_TOKEN=${NPM_AUTH_TOKEN} ac-cli sh -c "npm config set //registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN} && ${npmPublishCommand}"; then
                    echo "Publishing failed"
                    publishStatus=1
                fi
                docker image rm ac-cli
                exit $publishStatus
                '''
            }
        }
    }
}