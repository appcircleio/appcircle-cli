pipeline {
    agent { label 'agent'}
    parameters {
        booleanParam(name: 'PUBLISH', defaultValue: false, description: 'Trigger publish stage')
    }
    environment {
        NPM_AUTH_TOKEN = credentials('Appcircle-CLI-NPM-Cred')
        GITHUB_PAT = credentials('ozer-github-pat')
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
                set -x
                set +e  # Don't fail the build if badge update fails

                echo "📊 Updating coverage badges in README..."

                # Install dependencies if not already installed
                if [ ! -d "node_modules" ]; then
                    echo "📦 Installing dependencies..."
                    yarn install
                fi

                # Run tests to generate coverage
                echo "🧪 Running tests to generate coverage..."
                TEST_OUTPUT=$(npm test 2>&1)
                TEST_EXIT_CODE=$?

                if [ $TEST_EXIT_CODE -ne 0 ]; then
                    echo "⚠️  Tests failed, skipping badge update"
                    exit 0
                fi

                # Extract test count from output
                TESTS_PASSED=$(echo "$TEST_OUTPUT" | grep -oE 'Tests[[:space:]]+[0-9]+[[:space:]]+passed' | grep -oE '[0-9]+' | head -1)

                # Generate new badges with test count
                if [ -n "$TESTS_PASSED" ]; then
                    TEST_JSON="{\\\"passed\\\":$TESTS_PASSED}"
                    BADGES=$(node scripts/parse-coverage.js badges "$TEST_JSON" 2>/dev/null)
                    BADGE_EXIT_CODE=$?
                else
                    BADGES=$(node scripts/parse-coverage.js badges 2>/dev/null)
                    BADGE_EXIT_CODE=$?
                fi

                if [ $BADGE_EXIT_CODE -ne 0 ] || [ -z "$BADGES" ]; then
                    echo "⚠️  Failed to generate badges, skipping update"
                    exit 0
                fi

                echo "Generated badges:"
                printf '%s\\n' "$BADGES"

                # Update README.md with new badges
                if grep -q "^!\\[Coverage\\]" README.md; then
                    # Backup README
                    cp README.md README.md.bak

                    # Remove old badge lines (Coverage, Build, Tests, Branches, Functions)
                    grep -v "^!\\[Coverage\\]\\|^!\\[Build\\]\\|^!\\[Tests\\]\\|^!\\[Branches\\]\\|^!\\[Functions\\]" README.md > README.md.tmp || true

                    # Find the line number of NPM Version badge to insert after it
                    LINE_NUM=$(grep -n "^!\\[NPM Version\\]" README.md.tmp | cut -d: -f1)

                    if [ -n "$LINE_NUM" ]; then
                        # Insert new badges after NPM Version badge
                        head -n "$LINE_NUM" README.md.tmp > README.md.new
                        printf '%s\\n' "$BADGES" >> README.md.new
                        tail -n +$((LINE_NUM + 1)) README.md.tmp >> README.md.new
                        mv README.md.new README.md
                    else
                        # If NPM Version badge not found, just prepend to file
                        printf '%s\\n' "$BADGES" > README.md.new
                        echo "" >> README.md.new
                        cat README.md.tmp >> README.md.new
                        mv README.md.new README.md
                    fi

                    rm -f README.md.tmp

                    # Configure git
                    git config user.email "ozer@appcircle.io"
                    git config user.name "Özer from Jenkins"

                    # Check if there are changes
                    if git diff --quiet README.md; then
                        echo "ℹ️  No changes to coverage badges"
                        rm -f README.md.bak
                    else
                        # Create a new branch for the badge update
                        BRANCH_NAME="coverage-badges-$(date +%Y%m%d-%H%M%S)"

                        echo "📝 Creating branch: $BRANCH_NAME"
                        if git checkout -b "$BRANCH_NAME"; then
                            # Commit changes
                            git add README.md
                            if git commit -m "docs: update coverage badges [skip ci]"; then
                                # Push the branch
                                echo "📤 Pushing branch to remote..."
                                if git push https://${GITHUB_PAT}@github.com/appcircleio/appcircle-cli.git "$BRANCH_NAME"; then
                                    echo "🔀 Creating pull request via GitHub API..."

                                    # Create PR using GitHub API
                                    PR_RESPONSE=$(curl -s -X POST \
                                        -H "Authorization: token ${GITHUB_PAT}" \
                                        -H "Accept: application/vnd.github.v3+json" \
                                        -H "Content-Type: application/json" \
                                        "https://api.github.com/repos/appcircleio/appcircle-cli/pulls" \
                                        -d "{\"title\":\"docs: update coverage badges [skip ci]\",\"body\":\"🤖 Automated coverage badge update from Jenkins build #${BUILD_NUMBER}\",\"head\":\"$BRANCH_NAME\",\"base\":\"develop\"}")

                                    # Extract PR number from response
                                    PR_NUMBER=$(echo "$PR_RESPONSE" | grep -o '"number":[0-9]*' | head -1 | cut -d':' -f2)

                                    if [ -n "$PR_NUMBER" ]; then
                                        echo "✅ Created PR #${PR_NUMBER}"

                                        # Merge PR using GitHub API with bypass for branch protection
                                        # This requires the token to have admin permissions
                                        echo "🚀 Merging PR #${PR_NUMBER} (bypassing branch protection)..."
                                        MERGE_RESPONSE=$(curl -s -w "\\nHTTP_STATUS:%{http_code}" -X PUT \
                                            -H "Authorization: token ${GITHUB_PAT}" \
                                            -H "Accept: application/vnd.github+json" \
                                            -H "X-GitHub-Api-Version: 2022-11-28" \
                                            -H "Content-Type: application/json" \
                                            "https://api.github.com/repos/appcircleio/appcircle-cli/pulls/${PR_NUMBER}/merge" \
                                            -d '{"merge_method":"squash"}')

                                        # Extract HTTP status code
                                        HTTP_STATUS=$(echo "$MERGE_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
                                        MERGE_BODY=$(echo "$MERGE_RESPONSE" | sed '/HTTP_STATUS:/d')

                                        # Check if merge was successful (200 or 201)
                                        if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
                                            echo "✅ PR #${PR_NUMBER} merged successfully"

                                            # Delete the branch
                                            curl -s -X DELETE \
                                                -H "Authorization: token ${GITHUB_PAT}" \
                                                -H "Accept: application/vnd.github.v3+json" \
                                                "https://api.github.com/repos/appcircleio/appcircle-cli/git/refs/heads/$BRANCH_NAME" > /dev/null

                                            echo "✅ Coverage badges updated via PR #${PR_NUMBER}"
                                            rm -f README.md.bak
                                        else
                                            echo "⚠️  Failed to merge PR #${PR_NUMBER} (HTTP ${HTTP_STATUS})"
                                            echo "Response: $MERGE_BODY"
                                            echo "💡 This may be due to branch protection rules. Ensure the PAT has admin permissions."
                                            echo "💡 PR is open at: https://github.com/appcircleio/appcircle-cli/pull/${PR_NUMBER}"
                                            mv README.md.bak README.md
                                        fi
                                    else
                                        echo "⚠️  Failed to create PR"
                                        echo "Response: $PR_RESPONSE"
                                        mv README.md.bak README.md
                                    fi
                                else
                                    echo "⚠️  Failed to push branch, restoring backup"
                                    mv README.md.bak README.md
                                fi
                            else
                                echo "⚠️  Failed to commit changes, restoring backup"
                                mv README.md.bak README.md
                            fi
                        else
                            echo "⚠️  Failed to create branch, restoring backup"
                            mv README.md.bak README.md
                        fi
                    fi
                else
                    echo "⚠️  Coverage badge not found in README.md, skipping update"
                fi

                exit 0  # Always exit successfully
                '''
            }
        }

        stage('Publish') {
            when {
                expression { params.PUBLISH == true }
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