pipeline {
    agent { label 'agent'}
    environment {
        NPM_TOKEN = credentials('NPM_AUTH_TOKEN')
    }
    stages {

        stage('Publish') {
            steps {
                sh '''#!/bin/bash
                # shellcheck shell=bash
                set -x
                set -euo pipefail
                tag=$(git describe --tags --abbrev=0)
                echo "Tag: ${tag}"

                npmPublishCommand=""
                if [[ "${tag}" ]]; then
                    echo "Beta Release"
                    npmPublishCommand="npm publish --tag beta"
                elif [[ "${tag}" ]]; then
                    echo "Alpha Release"
                    npmPublishCommand="--tag alpha"
                else
                    echo "Production Release"
                    npmPublishCommand="npm publish"
                fi

                ## Build the image and make it ready for publishing.
                docker image build -t ac-cli .

                ## Publish the application.
                publishStatus=0
                # shellcheck disable=SC2086
                if ! docker run --rm --env NPM_AUTH_TOKEN=${NPM_TOKEN} ac-cli ${npmPublishCommand}; then
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