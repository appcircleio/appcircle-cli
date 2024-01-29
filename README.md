# Appcircle Command Line Interface

Appcircle CLI is a unified tool for accessing the Appcircle platform features from the command line.

# Installation

To install Appcircle CLI globally, simply launch:

```
npm install -g @appcircle/cli
```

alternatively, you can install Appcircle CLI locally:

```
npm install @appcircle/cli
```

# Usage & Commands

Simply launch the command on your Terminal/Command Line

```
appcircle
```

> If you have installed it locally, you should run `npx appcircle`

Below is the list of commands currently supported by Appcircle CLI:

| Command                                                                                                                                 | Description                                             |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `appcircle  (-i, --interactive)`                                                                                                        | AppCircle GUI                                           |
| `appcircle config <action> [options]`                                                                                                   | View and edit Appcircle CLI properties                  |
| `appcircle login [--pat]`                                                                                                               | Get an access token for the session                     |
| `appcircle listBuildProfiles`                                                                                                           | Get the list of build profiles                          |
| `appcircle listDistributionProfiles`                                                                                                    | Get the list of distribution profiles                   |
| `appcircle listBuildProfileWorkflows [--profileId]`                                                                                     | Get the list of workflows for the profile               |
| `appcircle listBuildProfileConfigurations [--profileId]`                                                                                     | Get the list of configurations for the profile               |
| `appcircle listBuildProfileBuildsOfCommit [--profileId]`                                                                                     | Get the list of commits of branch              |
| `appcircle listBuildProfileBuildsOfCommit [--profileId]`                                                                                     | Get the list of builds of a commit               |
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

## Logging requests

If you want to log the requests as `curl` commands you can start appcircle CLI by setting the `CURL_LOGGING` environment variable.

Example:

```
CURL_LOGGING= appcircle
```

## How to Configure your Appcircle CLI environment?

- Using the Appcircle CLI, add your custom configuration for self-hosted Appcircle

        appcircle config add self_env
        appcircle config set API_HOSTNAME https://api.your.appcircle.io
        appcircle config set AUTH_HOSTNAME https://auth.your.appcircle.io

- Change current configuration enviroment using `appcircle config current default`
- Set all these settings via interactive mode `appcircle -i`
- Print help of config command `appcircle config -h`

## How to Connect your Appcircle Account within CLI?

- [Generate a personal access token from the Appcircle dashboard](https://docs.appcircle.io/appcircle-api/api-authentication)
- Using the Appcircle CLI, create a full access API token using the following command with the personal access token specified as "pat": `appcircle login --pat="YOUR PERSONAL ACCESS TOKEN"`.

> Your token will be stored internally. You should always revoke your access token if you do not plan to use it in the future.

## How to start a new build via the Appcircle CLI?

- Add a build profile and [connect a repository](https://docs.appcircle.io/build/adding-a-build-profile#connect-your-repository)

- Get the build profile ID using `appcircle listBuildProfiles`
- Get the workflows of that build profile `appcircle listBuildProfileWorkflows --profileId="YOUR PROFILE ID"`
- Start a new build using `appcircle build --profileId="YOUR PROFILE ID" --branch="YOUR BRANCH" --workflow="YOUR WORKFLOW ID"`

## How to distribute an app via the Appcircle CLI?

- Create a distribution profile and [share with the testers](https://docs.appcircle.io/distribute/create-or-select-a-distribution-profile)
- Enable [auto sending](https://docs.appcircle.io/distribute/create-or-select-a-distribution-profile#auto-send-your-build-to-the-testers) of the build to the testers
- Get the distribution profile ID using `appcircle listDistributionProfiles`
- Upload your app binary to the selected distribution profile using `appcircle upload --app="YOUR APP PATH" --profileId="YOUR PROFILE ID" --message="YOUR RELEASE NOTES"`

# Contribution

- Clone this repository
- Install dependencies by using `yarn` command
- Launch `yarn run watch` to compile & open the project on watch mode
- Make your changes
- Submit a PR

# Publishing

- After changes, run the command `yarn run postversion`. It will push a new tag to the repository.
- Jenkins will take care of the rest.

## Jenkins Pipeline

- Jenkins will look for the tag that matches `v*`, `v*-beta*`, `v*-alpha*`.

- If a new tag is published, the pipeline will be triggered automatically and publish the application.

- If the tag is `v*`, the app will be published to the stable channel.

- If the tag is `v*-beta*`, the app will be published to the beta channel.

- If the tag is `v*-alpha*`, the app will be published to the alpha channel.

# Docker Image

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
