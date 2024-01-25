pipeline {

    agent { label 'agent'}

    stages {

        stage('Publish for Beta') {
            when {tag '*-beta*'}
            steps {
                withCredentials([string(credentialsId: 'NPM_AUTH_TOKEN', variable: 'NPM_AUTH_TOKEN')]) {
                    sh '''#!/bin/bash
                    # shellcheck shell=bash
                    set -euo pipefail

                    export NPM_AUTH_TOKEN=abcd
                    echo "Tag: ${tag}"
                    echo "Branch: ${branch}"
                    echo "Npm token: ${NPM_AUTH_TOKEN}"
                    docker image build -t ac-cli --build-arg NPM_AUTH_TOKEN=abcd
                '''

                }
            }
        }
    }
}