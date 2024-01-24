pipeline {

    agent { label 'agent'}

    environment {
        NPM_AUTH_TOKEN     = credentials('b85730d0-5596-41f7-9592-f70a6ccf99db')
    }

    stages {

        stage('Info') {
            steps {
                eecho'${NPM_AUTH_TOKEN}'
                echo '${tag}'
                echo '${branch}'
                sh 'env'
                sh 'npm install yarn -g'
                sh 'yarn'
            }
        }

        stage('Publish for Beta') { 
            when {tag '*-beta'}
            steps {
                echo 'Run "npm publish --tag beta"'
            }
        }
        /*
        stage('Prepare') {
            sh "npm install -g yarn"
            sh "yarn install"
        }
        */

        stage('Yarn build') { 
            steps {
                sh 'yarn' 
                sh 'yarn build'
            }
        }
        stage('Check package version is releasable') { 
            steps {
                sh 'yarn check:package'
            }
        }
        stage('Publish') {

            steps {

                load "$JENKINS_HOME/jobvars.env"
                echo "$JENKINS_HOME/jobvars.env"
            
                withEnv(["TOKEN=${NPMJS_TOKEN}"]) {
                    sh 'env'
                    /*
                    sh 'echo "//registry.npmjs.org/:_authToken=${TOKEN}" >> ~/.npmrc'
                    sh 'npm publish' 
                     */

                }
           
            }
            
        }
    }
}