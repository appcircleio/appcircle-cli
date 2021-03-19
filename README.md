# Appcircle Command Line Interface

Appcircle CLI is a unified tool for running Appcircle services from the command line.

# Installation

```
npm install -g appcircle-cli
```

## Commands

Below is the list of commands currently supported by Appcircle CLI:

| Command                               | Description                                                    |
| ------------------------------------- | -------------------------------------------------------------- |
| `appcircle login` | Get access token |
| `appcenter listBuildProfiles` | Get list of build profiles |
| `appcenter listDistributionProfiles` | Get list of distribution profiles |
| `appcenter build` | Start a new build |
| `appcenter upload` | Upload your mobile app to selected distribution profile |

## How to start a new build via Appcircle CLI?

- Add a build profile and [connect repository](https://docs.appcircle.io/build/adding-a-build-profile#connect-your-repository)
- Generate personal access token from appcircle
- Create full access api token using `appcircle login ${pat}`. Copy the result and set `AC_ACCESS_TOKEN` enviroment variable.
- Get build profile id using `appcenter listBuildProfiles`
- Start a new build using `appcenter build ${profileId} ${branch}`

## How to distribute app via Appcircle CLI?

- Create a distribution profile and [share with testers](https://docs.appcircle.io/distribute/create-or-select-a-distribution-profile)
- Enable [auto send](https://docs.appcircle.io/distribute/create-or-select-a-distribution-profile#auto-send-your-build-to-the-testers) your build to the testers
- Generate personal access token from appcircle
- Create full access api token using `appcircle login ${pat}`. Copy the result and set `AC_ACCESS_TOKEN` enviroment variable.
- Get distribution profile id using `appcenter listDistributionProfiles`
- Upload your mobile app to selected distribution profile using `appcenter upload ${app} ${profileId} ${release_notes}`
