![NPM Version](https://img.shields.io/npm/v/%40appcircle%2Fcli?label=@appcircle%2Fcli&labelColor=ff8e34&color=5a789e)

# Appcircle Command Line Interface

Appcircle CLI is a unified tool for accessing the Appcircle platform features from the command line.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Installation Instructions](#installation-instructions)
- [Usage Guidelines](#usage-guidelines)
   - [Command List](#core-commands)
- [Environment Variables](#environment-variables)
- [Interactive Mode](#interactive-mode)
- [Logging Requests](#logging-requests)
- [Guides and Tutorials](#guides-and-tutorials)
  - [Configuring Your Appcircle CLI Environment](#configuring-your-appcircle-cli-environment)
  - [Trusting Your Self-Hosted Appcircle Certificate](#trusting-your-self-hosted-appcircle-certificate)
  - [Connecting Your Appcircle Account via CLI](#connecting-your-appcircle-account-via-cli)
  - [Starting a New Build via the Appcircle CLI](#starting-a-new-build-via-the-appcircle-cli)
  - [Distributing an App via the Appcircle CLI](#distributing-an-app-via-the-appcircle-cli)
- [Migration Guides](#migration-guides)

## Installation Instructions

To install Appcircle CLI globally, simply launch:

```
npm install -g @appcircle/cli
```

alternatively, you can install Appcircle CLI locally:

```
npm install @appcircle/cli
```

## Usage Guidelines

To get started :

1. Follow the [installation instructions](#installation-instructions)

2. Simply launch the command on your Terminal/Command Line

```
appcircle
```

> If you have installed it locally, you should run `npx appcircle`

3. Set any needed [environment variables](#configuring-your-appcircle-cli-environment).

4. If you are using a self-signed SSL certificate on a self-hosted Appcircle server, [trust the SSL certificate](#trusting-your-self-hosted-appcircle-certificate) of the server to ensure secure communication between the CLI and the server.

5. [Authenticate](https://docs.appcircle.io/appcircle-api/api-authentication) into your Appcircle account.



Below is the list of commands currently supported by Appcircle CLI:

### Core Commands

Run `appcircle [commandName] --help` to view a list of  commands/subcommands in your terminal.

- [appcircle config](/docs/config/index.md)
- [appcircle login](/docs/login/index.md)
- [appcircle build](/docs/build/index.md)
- [appcircle signing-identity](/docs/signing-identity/index.md)
- [appcircle testing-distribution](/docs/testing-distribution/index.md)
- [appcircle publish](/docs/publish/index.md)
- [appcircle enterprise-app-store](/docs/enterprise-app-store/index.md)
- [appcircle organization](/docs/organization/index.md)

The commands follow this pattern:

```shell
appcircle <command> <subcommand> ... <subcommand> [options]
```

- Run `appcircle (-i, --interactive)` to proceed with the Appcircle GUI

#### JSON Output

To receive the command outputs in JSON format, append the following to the end of the command:

```shell
appcircle <command> <subcommand> ... <subcommand> [options] -o json
```

## Environment Variables
- `AC_ACCESS_TOKEN`: An authentication token for API requests. Setting this avoids being
  prompted to authenticate and overrides any previously stored credentials.
  Can be set in the config with `appcircle config set AUTH_HOSTNAME xxxxxx`

- `API_HOSTNAME`: Specifies the host where the API endpoint is located. [See also](#configuring-your-appcircle-cli-environment) for more details.

- `AUTH_HOSTNAME`: Specifies the host where your IAM (identity access management) server endpoint is located. [See also](#configuring-your-appcircle-cli-environment) for more details.

## Interactive Mode

Appcircle CLI incorporates a GUI that allows users to interactively access its features. To view all features in interactive mode, execute the following command:

```
appcircle -i
```

### Demo
![Demo](https://cdn.appcircle.io/docs/assets/appcircle_gui_demo.gif)

## Logging Requests

If you want to log the requests as `curl` commands you can start appcircle CLI by setting the `CURL_LOGGING` environment variable.

Example:

```
CURL_LOGGING= appcircle
```

## Guides and Tutorials

### Configuring Your Appcircle CLI Environment

- Using the Appcircle CLI, add your custom configuration for self-hosted Appcircle

        appcircle config add self_env
        appcircle config set API_HOSTNAME https://api.your.appcircle.io
        appcircle config set AUTH_HOSTNAME https://auth.your.appcircle.io

- Change current configuration enviroment using `appcircle config current self_env`
- Set all these settings via interactive mode `appcircle -i`
- Print help of config command `appcircle config -h`

### Trusting Your Self-Hosted Appcircle Certificate

- After you configure the Appcircle CLI, you can run the the command below to trust SSL certificate.

        appcircle config trust

- This command will try to extract the SSL certificate from the API_HOSTNAME host and make it trusted on your computer.

- For detailed usage, please refer to the [Trusting SSL Certificate](https://docs.appcircle.io/self-hosted-appcircle/configure-server/appcircle-cli#trusting-the-ssl-certificate-recommended) documentation.

### Connecting Your Appcircle Account via CLI

- [Generate a personal access token from the Appcircle dashboard](https://docs.appcircle.io/appcircle-api/api-authentication#generatingmanaging-the-personal-api-tokens)
- Using the Appcircle CLI, create a full access API token using the following command with the personal access token specified as "pat": `appcircle login --pat="YOUR PERSONAL ACCESS TOKEN"`.

> Your token will be stored internally. You should always revoke your access token if you do not plan to use it in the future.

### Starting a New Build via the Appcircle CLI

- Add a build profile and [connect a repository](https://docs.appcircle.io/build/adding-a-build-profile#connect-your-repository)

- Get the build profile ID using `appcircle build profile list`
- Get the workflows of that build profile `appcircle build profile workflows --profileId="YOUR PROFILE ID"`
- Start a new build using `appcircle build start --profileId="YOUR PROFILE ID" --branch="YOUR BRANCH" --workflow="YOUR WORKFLOW ID"`

> **Note:** When starting a build, logs are automatically downloaded upon completion. You can also manually download logs using `appcircle build download-log --taskId="YOUR_TASK_ID"` or with commit/build IDs.
#### Build Log Download Improvements

Appcircle CLI includes the following improvements for build log downloading functionality:

- Build logs are automatically downloaded when a build is completed
- A 2-minute waiting period with 5-second retry intervals is implemented for log files
- User-friendly animation is displayed: "Waiting for build logs to be prepared..."
- Support for manual log download with both task ID (`--taskId`) and commit/build ID (`--commitId`/`--buildId`) parameters
- Automatic fallback to alternative download methods when the primary method fails
- Log files are saved with descriptive filenames that include branch name, profile name, and timestamp: `{branchName}-{profileName}-build-logs-{timestamp}.txt`

To download build logs:
```shell
# Download using Task ID (preferred method)
appcircle build download-log --taskId="YOUR_TASK_ID"

# Download using Commit ID and Build ID (alternative method)
appcircle build download-log --commitId="YOUR_COMMIT_ID" --buildId="YOUR_BUILD_ID"
```

### Distributing an App via the Appcircle CLI

- Create a distribution profile and [share with the testers](https://docs.appcircle.io/distribute/create-or-select-a-distribution-profile)
- Enable [auto sending](https://docs.appcircle.io/distribute/create-or-select-a-distribution-profile#auto-send-your-build-to-the-testers) of the build to the testers
- Get the distribution profile ID using `appcircle testing-distribution profile list`
- Upload your app binary to the selected distribution profile using `appcircle testing-distribution upload --app="YOUR APP PATH" --distProfileId="YOUR PROFILE ID" --message="YOUR RELEASE NOTES"`


## Migration Guides

- [1.x to 2.0](docs/migration-guides/1.x-to-2.0.md)
- [2.0 to 2.x](docs/migration-guides/2.0-to-2.x.md)
