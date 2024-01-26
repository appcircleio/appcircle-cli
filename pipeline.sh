#!/bin/bash
# shellcheck shell=bash
set -x
set -euo pipefail
tag=$(git describe --tags --abbrev=0)
echo "Tag: ${tag}"

npmPublishCommand=""
if [[ "${tag}" ]]; then
  echo "Beta Release"
  npmPublishCommand="npm publish --tag beta"
elif [[ "${tag}" ]]; then
  echo "Alpha Release"
  npmPublishCommand="--tag alpha"
else
  echo "Production Release"
  npmPublishCommand="npm publish"
fi

## Build the image and make it ready for publishing.
docker image build -t ac-cli .

# shellcheck disable=SC2086
if ! docker run --rm --env NPM_AUTH_TOKEN=abcd ac-cli ${npmPublishCommand}; then
  echo "Publishing failed"
fi
docker image rm ac-cli
