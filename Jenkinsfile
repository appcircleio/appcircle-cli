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
                sh '''#!/bin/bash
                # shellcheck shell=bash
                set -x
                set -euo pipefail
                
                echo "🔨 Starting PR Validation Pipeline 🔨"
                echo "=================================="
                
                echo "📦 Installing dependencies..."
                yarn install
                
                echo "⚙️  Running TypeScript compilation..."
                if ! npm run build; then
                    echo "❌ TypeScript compilation failed! 😢"
                    exit 1
                fi
                echo "✅ TypeScript compilation successful! 🎉"
                
                echo "🧪 Running unit tests..."
                if ! npm test; then
                    echo "❌ Unit tests failed! 💔"
                    exit 1
                fi
                echo "✅ Unit tests passed! 🌟"
                
                echo "=================================="
                echo "🎯 PR validation complete - All checks passed! 🚀"
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