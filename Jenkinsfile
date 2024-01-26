pipeline {
    agent { label 'agent'}
    stages {
        stage('Publish') {
            steps {
                sh '''#!/bin/bash
                # shellcheck shell=bash
                set -euo pipefail
                tag=$(git describe --tags --abbrev=0)
                echo "Tag: ${tag}"

                npmPublishArgument=""
                if [[ "${tag}"  ]]; then
                echo "Beta Release"
                npmPublishArgument="--tag beta"
                elif [[ "${tag}" ]]; then
                echo "Alpha Release"
                npmPublishArgument="--tag alpha"
                else
                echo "Production Release"
                fi

                docker image build -t ac-cli --build-arg NPM_AUTH_TOKEN=abcd .
                echo "docker run --rm ac-cli ${npmPublishArgument}"
                # shellcheck disable=SC2086
                docker run --rm ac-cli ${npmPublishArgument}
                docker image rm ac-cli
                '''
            }
        }
    }
}