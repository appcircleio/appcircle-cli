pipeline {
    agent { label 'agent'}
    environment {
        NPM_AUTH_TOKEN = credentials('Appcircle-CLI-NPM-Cred')
    }
    stages {
        stage('PR Validation') {
            when {
                changeRequest()
            }
            steps {
                withCredentials([string(credentialsId: 'GithubUserNamePersonalToken', variable: 'GITHUB_TOKEN')]) {
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

                echo "📊 Posting coverage report to PR..."
                # This section is optional and won't fail the build
                set +e  # Don't exit on error for coverage posting
                if [ -n "${GITHUB_TOKEN:-}" ]; then
                    # Generate PR comment
                    COVERAGE_COMMENT=$(node scripts/parse-coverage.js pr-comment 2>/dev/null)

                    if [ $? -eq 0 ] && [ -n "$COVERAGE_COMMENT" ]; then
                        # Escape comment for JSON
                        ESCAPED_COMMENT=$(echo "$COVERAGE_COMMENT" | jq -Rs . 2>/dev/null)

                        if [ $? -eq 0 ]; then
                            # Post comment to PR
                            HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/gh_response.json -X POST \
                              -H "Authorization: token ${GITHUB_TOKEN}" \
                              -H "Accept: application/vnd.github.v3+json" \
                              "https://api.github.com/repos/appcircleio/appcircle-cli/issues/${CHANGE_ID}/comments" \
                              -d "{\"body\": $ESCAPED_COMMENT}" 2>/dev/null)

                            if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
                                echo "✅ Coverage comment posted to PR #${CHANGE_ID}"
                            else
                                echo "⚠️  Failed to post coverage comment (HTTP ${HTTP_CODE:-unknown}), continuing..."
                            fi
                        else
                            echo "⚠️  Failed to format coverage comment, continuing..."
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
                branch 'develop'
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
                if ! npm test; then
                    echo "⚠️  Tests failed, skipping badge update"
                    exit 0
                fi

                # Generate new badges
                BADGES=$(node scripts/parse-coverage.js badges 2>/dev/null)

                if [ $? -ne 0 ] || [ -z "$BADGES" ]; then
                    echo "⚠️  Failed to generate badges, skipping update"
                    exit 0
                fi

                echo "Generated badges:"
                echo "$BADGES"

                # Update README.md with new badges
                if grep -q "^!\\[Coverage\\]" README.md; then
                    # Backup README
                    cp README.md README.md.bak

                    # Replace coverage badge line using a temp file
                    grep -v "^!\\[Coverage\\]\\|^!\\[Branches\\]\\|^!\\[Functions\\]" README.md > README.md.tmp || true

                    # Find the line number of NPM Version badge
                    LINE_NUM=$(grep -n "^!\\[NPM Version\\]" README.md.tmp | cut -d: -f1)

                    if [ -n "$LINE_NUM" ]; then
                        # Insert new badges after NPM Version badge
                        head -n "$LINE_NUM" README.md.tmp > README.md.new
                        echo "$BADGES" >> README.md.new
                        tail -n +$((LINE_NUM + 1)) README.md.tmp >> README.md.new
                        mv README.md.new README.md
                    else
                        # If NPM Version badge not found, just prepend to file
                        echo "$BADGES" > README.md.new
                        echo "" >> README.md.new
                        cat README.md.tmp >> README.md.new
                        mv README.md.new README.md
                    fi

                    rm -f README.md.tmp

                    # Configure git
                    git config user.email "jenkins@appcircle.io"
                    git config user.name "Appcircle Jenkins"

                    # Check if there are changes
                    if git diff --quiet README.md; then
                        echo "ℹ️  No changes to coverage badges"
                        rm -f README.md.bak
                    else
                        # Commit and push with [skip ci] to avoid triggering another build
                        git add README.md
                        if git commit -m "docs: update coverage badges [skip ci]"; then
                            if git push origin develop; then
                                echo "✅ Coverage badges updated in README.md"
                                rm -f README.md.bak
                            else
                                echo "⚠️  Failed to push changes, restoring backup"
                                mv README.md.bak README.md
                            fi
                        else
                            echo "⚠️  Failed to commit changes, restoring backup"
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
                not { changeRequest() }
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