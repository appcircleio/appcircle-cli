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
                
                echo "Building Docker image for PR validation..."
                docker image build -t ac-cli-pr .
                
                echo "Running unit tests with coverage..."
                testStatus=0
                if ! docker run --rm ac-cli-pr sh -c "npm test"; then
                    echo "Unit tests failed or coverage threshold not met"
                    testStatus=1
                fi
                
                echo "Cleaning up Docker image..."
                docker image rm ac-cli-pr
                
                if [ $testStatus -eq 1 ]; then
                    echo "PR validation failed - tests must pass and coverage must be >= 75%"
                    exit 1
                fi
                
                echo "PR validation passed - all tests pass and coverage >= 75%"
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