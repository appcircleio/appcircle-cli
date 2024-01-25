pipeline {
    agent { label 'agent'}
    stages {
        stage('Publish') {
            steps {
                sh '''#!/bin/bash
                # shellcheck shell=bash
                set -euo pipefail
                tag=$(git describe --tags --abbrev=0)
                branch=$(git rev-parse --abbrev-ref HEAD)
                echo "Tag: ${tag}"
                echo "Branch: ${branch}"
                # echo "Npm token: ${NPM_AUTH_TOKEN}"
                docker image build -t ac-cli --build-arg NPM_AUTH_TOKEN=abcd
                # docker run --rm ac-cli npm publish
                docker image rm ac-cli
                '''
            }
        }
    }
}