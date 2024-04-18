![NPM Version](https://img.shields.io/npm/v/%40appcircle%2Fcli?label=@appcircle%2Fcli&labelColor=ff8e34&color=5a789e)

# Appcircle Command Line Interface

Appcircle CLI is a unified tool for accessing the Appcircle platform features from the command line.

## Table of contents

- [Table of contents](#table-of-contents)
- [Installation](#installation)
- [Usage](#usage)
   - [Commands](#commands)
- [Environment Variables](#environment-variables)
- [Interactive Mode](#interactive-mode)
- [Logging requests](#logging-requests)
- [Guides](#guides)
  - [How to Configure your Appcircle CLI environment?](#how-to-configure-your-appcircle-cli-environment)
  - [How to Trust your Self-Hosted Appcircle Certificate?](#how-to-trust-your-self-hosted-appcircle-certificate)
  - [How to Connect your Appcircle Account within CLI?](#how-to-connect-your-appcircle-account-within-cli)
  - [How to start a new build via the Appcircle CLI?](#how-to-start-a-new-build-via-the-appcircle-cli)
  - [How to distribute an app via the Appcircle CLI?](#how-to-distribute-an-app-via-the-appcircle-cli)
- [Contribution](#contribution)
- [Publishing](#publishing)
- [Jenkins pipeline](#jenkins-pipeline)
- [Docker image](#docker-image)


## Usage

To get started :

1. Follow the [installation instructions](#installation)

2. Simply launch the command on your Terminal/Command Line

```
appcircle
```

> If you have installed it locally, you should run `npx appcircle`

3. Set any needed [environment variables](#how-to-configure-your-appcircle-cli-environment).

4. If you are using a self-signed SSL certificate on the self-hosted Appcircle server, [trust the SSL certificate](#how-to-trust-your-self-hosted-appcircle-certificate) of the Appcircle server to secure the network between the CLI and the server.

5. [Authenticate](https://docs.appcircle.io/appcircle-api/api-authentication) into your account of Appcircle



Below is the list of commands currently supported by Appcircle CLI:

### Core Commands

Run `appcircle [commandName] --help` to view a list of  commands/subcommands in your terminal.

- [appcircle config](/docs/config/index.md)
- [appcircle login](/docs/login.md)
- [appcircle build](/docs/build.md)
- [appcircle distribution](/docs/distribution.md)
- [appcircle organization](/docs/organization.md)
- [appcircle publish](/docs/publish.md)
- [appcircle enterprise-app-store](/docs/enterprise-app-store.md)

Commands follow this pattern:

```shell
appcircle <command> <subcommand> ... <subcommand> [options]
```

- Run `appcircle (-i, --interactive)` to proceed with the Appcircle GUI

| Command                                                                                                                                 | Description                                             |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `appcircle  (-i, --interactive)`                                                                                                        | AppCircle GUI                                           |
| `appcircle  help [commandName]`                                                                                                         | Display help for command                                |
| `appcircle config <subcommand> [argument] [options]`                                                                                                   | View and edit Appcircle CLI properties                  |
| `appcircle login [--pat]`                                                                                                               | Get an access token for the session                     |
| `appcircle organization <subcommand> [action] [options]`                                                                                                   | Manage organization users, roles, and details                  |
 `appcircle publish <subcommand> [options]`                                                                                                   | Manage publish module actions                  |
| `appcircle listBuildProfiles`                                                                                                           | Get the list of build profiles                          |
| `appcircle listDistributionProfiles`                                                                                                    | Get the list of distribution profiles                   |
| `appcircle listBuildProfileWorkflows [--profileId]`                                                                                     | Get the list of workflows for the profile               |
| `appcircle listBuildProfileConfigurations [--profileId]`                                                                                | Get the list of configurations for the profile          |
| `appcircle listBuildProfileBuildsOfCommit [--profileId]`                                                                                | Get the list of commits of branch                       |
| `appcircle listBuildProfileBuildsOfCommit [--profileId]`                                                                                | Get the list of builds of a commit                      |
| `appcircle build [--profileId] [--branch] [--workflow]`                                                                                 | Start a new build                                       |
| `appcircle download [--path] [--commitId] [--buildId]`                                                                                  | Download the artifact under the selected path           |
| `appcircle upload [--app] [--message] [--profileId]`                                                                                    | Upload your app binary to selected distribution profile |
| `appcircle createDistributionProfile [--name]`                                                                                          | Create a distribution profile                           |
| `appcircle listEnvironmentVariableGroups`                                                                                               | Get list of environment variable groups                 |
| `appcircle createEnvironmentVariableGroup [--name]`                                                                                     | Create an environment variable group                    |
| `appcircle listEnvironmentVariables [--variableGroupId]`                                                                                | Get list of environment variables                       |
| `appcircle createEnvironmentVariable [--type] [-isSecret, --isSecret] [--variableGroupId] [--key] [--value] [--filePath]`               | Create a file or text environment variable              |
| `appcircle listEnterpriseProfiles`                                                                                                      | List Enterprise profiles                                |
| `appcircle listEnterpriseAppVersions [--entProfileId] [--publishType]`                                                                  | List Enterprise app versions                            |
| `appcircle publishEnterpriseAppVersion [--entProfileId] [--entVersionId] [--entVersionId] [--summary] [--releaseNotes] [--publishType]` | Publish Enterprise app version                          |
| `appcircle publishEnterpriseAppVersion [--entProfileId] [--entVersionId]`                                                               | Unpublish Enterprise app version                        |
| `appcircle removeEnterpriseAppVersion [--entProfileId] [--entVersionId]`                                                                | Remove Enterprise app version                           |
| `appcircle notifyEnterpriseAppVersion [--entProfileId] [--entVersionId] [--subject] [--message]`                                        | Notify Enterprise app version                           |
| `appcircle uploadEnterpriseApp [--app] `                                                                                                | Upload Enterprise app version without a profile         |
| `appcircle uploadEnterpriseAppVersion [--entProfileId] [--app] `                                                                        | Upload enterprise app version for a profile             |
| `appcircle getEnterpriseDownloadLink  [--entProfileId] [--entVersionId]`                                                                | Get enterprise app download link                        |


## Installation

To install Appcircle CLI globally, simply launch:

```
npm install -g @appcircle/cli
```

alternatively, you can install Appcircle CLI locally:

```
npm install @appcircle/cli
```

## Environment variables
- `AC_ACCESS_TOKEN`: an authentication token for API requests. Setting this avoids being
  prompted to authenticate and overrides any previously stored credentials.
  Can be set in the config with `appcircle config set AUTH_HOSTNAME xxxxxx`

- `API_HOSTNAME`: specify the host where the API endpoint is found. [See also](#how-to-configure-your-appcircle-cli-environment) for more details.

- `AUTH_HOSTNAME`: specify the host where your IAM(identity access management) server endpoint is found. [See also](#how-to-configure-your-appcircle-cli-environment) for more details.

## Interactive Mode

Appcircle CLI incorporates a GUI that allows users to interactively access its features. To view all features in interactive mode, execute the following command:

```
appcircle -i
```

### Demo
![Demo](https://cdn.appcircle.io/docs/assets/appcircle_gui_demo.gif)

## Logging requests

If you want to log the requests as `curl` commands you can start appcircle CLI by setting the `CURL_LOGGING` environment variable.

Example:

```
CURL_LOGGING= appcircle
```

## Guides

### How to Configure your Appcircle CLI environment?

- Using the Appcircle CLI, add your custom configuration for self-hosted Appcircle

        appcircle config add self_env
        appcircle config set API_HOSTNAME https://api.your.appcircle.io
        appcircle config set AUTH_HOSTNAME https://auth.your.appcircle.io

- Change current configuration enviroment using `appcircle config current self_env`
- Set all these settings via interactive mode `appcircle -i`
- Print help of config command `appcircle config -h`

### How to Trust your Self-Hosted Appcircle Certificate?

- After you configure the Appcircle CLI, you can run the the command below to trust SSL certificate.

        appcircle config trust

- This command will try to extract the SSL certificate from the API_HOSTNAME host and make it trusted on your computer.

- For detailed usage, please refer to the [Trusting SSL Certificate](https://docs.appcircle.io/self-hosted-appcircle/configure-server/appcircle-cli#trusting-the-ssl-certificate-recommended) documentation.

### How to Connect your Appcircle Account within CLI?

- [Generate a personal access token from the Appcircle dashboard](https://docs.appcircle.io/appcircle-api/api-authentication#generatingmanaging-the-personal-api-tokens)
- Using the Appcircle CLI, create a full access API token using the following command with the personal access token specified as "pat": `appcircle login --pat="YOUR PERSONAL ACCESS TOKEN"`.

> Your token will be stored internally. You should always revoke your access token if you do not plan to use it in the future.

### How to start a new build via the Appcircle CLI?

- Add a build profile and [connect a repository](https://docs.appcircle.io/build/adding-a-build-profile#connect-your-repository)

- Get the build profile ID using `appcircle build profile list`
- Get the workflows of that build profile `appcircle build profile workflows --profileId="YOUR PROFILE ID"`
- Start a new build using `appcircle build start --profileId="YOUR PROFILE ID" --branch="YOUR BRANCH" --workflow="YOUR WORKFLOW ID"`

### How to distribute an app via the Appcircle CLI?

- Create a distribution profile and [share with the testers](https://docs.appcircle.io/distribute/create-or-select-a-distribution-profile)
- Enable [auto sending](https://docs.appcircle.io/distribute/create-or-select-a-distribution-profile#auto-send-your-build-to-the-testers) of the build to the testers
- Get the distribution profile ID using `appcircle distribution profile list`
- Upload your app binary to the selected distribution profile using `appcircle upload --app="YOUR APP PATH" --profileId="YOUR PROFILE ID" --message="YOUR RELEASE NOTES"`

## Contribution

- Clone this repository
- Install dependencies by using `yarn` command
- Launch `yarn run watch` to compile & open the project on watch mode
- Make your changes
- Submit a PR

## Publishing

- After changes, run the command `yarn run postversion`. It will push a new tag to the repository.
- Jenkins will take care of the rest.

## Jenkins pipeline

- Jenkins will look for the tag that matches `v*`, `v*-beta*`, `v*-alpha*`.

- If a new tag is published, the pipeline will be triggered automatically and publish the application.

- If the tag is `v*`, the app will be published to the stable channel.

- If the tag is `v*-beta*`, the app will be published to the beta channel.

- If the tag is `v*-alpha*`, the app will be published to the alpha channel.

## Docker image

- Docker image is for building and publishing the application anywhere.

- For building and publishing the application to the beta channgel:

```bash
docker image build -t ac-cli .
docker run --rm --env NPM_AUTH_TOKEN=abcd ac-cli npm publish --tag beta
```

- For building and publishing the application to the production:

```bash
docker image build -t ac-cli --build-arg NPM_AUTH_TOKEN=abcd .
docker run --rm --env NPM_AUTH_TOKEN=abcd ac-cli npm publish
```
