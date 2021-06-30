# Appcircle Command Line Interface

Appcircle CLI is a unified tool for accessing the Appcircle platform features from the command line.

# Installation

To install Appcircle CLI globally, simply launch:

```
npm install -g @appcircle/appcircle-cli
```

alternatively, you can install Appcircle CLI locally:

```
npm install @appcircle/appcircle-cli
```

# Usage & Commands

Simply launch the command on your Terminal/Command Line

```
appcircle
```

> If you have installed it locally, you should run `npx appcircle` 

Below is the list of commands currently supported by Appcircle CLI:

| Command                                                                                                                     | Description                                             |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `appcircle`                                                                                                                 | AppCircle GUI                                           |
| `appcircle login [--pat]`                                                                                                   | Get an access token for the session                     |
| `appcircle listBuildProfiles`                                                                                               | Get the list of build profiles                          |
| `appcircle listDistributionProfiles`                                                                                        | Get the list of distribution profiles                   |
| `appcircle build [--profileId] [--branch]`                                                                                  | Start a new build                                       |
| `appcircle download [--path] [--commitId] [--buildId]`                                                                        | Download the artifact under the selected path |
| `appcircle upload [--app] [--message] [--profileId]`                                                                        | Upload your app binary to selected distribution profile |
| `appcircle createDistributionProfile [--name]`                                                                              | Create a distribution profile                           |
| `appcircle listEnvironmentVariableGroups`                                                                                   | Get list of environment variable groups                 |
| `appcircle createEnvironmentVariableGroup [--name]`                                                                         | Create an environment variable group                    |
| `appcircle listEnvironmentVariables [--variableGroupId]`                                                                    | Get list of environment variables                       |
| `appcircle createEnvironmentVariable [--type] [-isSecret, --isSecret] [--variableGroupId] [--key] [--value] [--filePath]`   | Create a file or text environment variable              |

## How to Connect your Appcircle Account within CLI?
- [Generate a personal access token from the Appcircle dashboard](https://docs.appcircle.io/appcircle-api/api-authentication)
- Using the Appcircle CLI, create a full access API token using the following command with the personal access token specified as "pat": `appcircle login --pat="YOUR PERSONAL ACCESS TOKEN"`.

> Your token will be stored internally. You should always revoke your access token if you do not plan to use it in the future.
## How to start a new build via the Appcircle CLI?

- Add a build profile and [connect a repository](https://docs.appcircle.io/build/adding-a-build-profile#connect-your-repository)

- Get the build profile ID using `appcircle listBuildProfiles`
- Start a new build using `appcircle build --profileId="YOUR PROFILE ID" --branch="YOUR BRANCH"`

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
- GitHub Actions will take care of the rest.