# Contributing to Appcircle Command Line Interface

## Table of Contents

- [Table of Contents](#table-of-contents)
- [How to Contribute](#how-to-contribute)
- [Publishing Guidelines](#publishing-guidelines)
- [Jenkins Pipeline](#jenkins-pipeline)
- [Docker Image](#docker-image)


## How to Contribute

- Clone this repository
- Install dependencies by using `yarn` command
- Launch `yarn run watch` to compile & open the project on watch mode
- Make your changes
- Submit a PR

## Publishing Guidelines

- After changes, run the command `yarn run postversion`. It will push a new tag to the repository.
- Jenkins will take care of the rest.

### Publishing to NPM

To publish a new version on NPM, use the following command:

```shell
npm version <version>
```

#### Examples

```shell
## To publish a beta version
$ npm version 1.0.0-beta.1

$ npm version 1.0.0
```

## Jenkins Pipeline

- Jenkins will look for the tag that matches `v*`, `v*-beta*`, `v*-alpha*`.

- If a new tag is published, the pipeline will be triggered automatically and publish the application.

- If the tag is `v*`, the app will be published to the stable channel.

- If the tag is `v*-beta*`, the app will be published to the beta channel.

- If the tag is `v*-alpha*`, the app will be published to the alpha channel.


## Docker Image

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