# `appcircle build download`

## Description
Download Artifacts

Download your artifact to the given directory on your machine.

```plaintext
appcircle build download [options]
```

## Artifact Filename

By default, the downloaded artifact will be saved as `artifacts-{timestamp}.zip`, where `{timestamp}` is the current date and time in `YYYYMMDD-HHMMSS` format. This ensures each download has a unique filename.

## Download Path

If the `--path` option is not specified, the artifact will be downloaded to your system's `~/Downloads` directory by default.

## Options

```plaintext
  --path <string>      [OPTIONAL] The path for artifacts to be downloaded. Defaults to ~/Downloads if not specified.
  --profileId <uuid>   Build profile ID
  --profile <string>   Build profile name (alternative to --profileId)
  --branchId <uuid>    Branch ID
  --branch <string>    Branch name (alternative to --branchId)
  --commitId <uuid>    Commit ID of your build
  --buildId <uuid>     Build ID
```
## Options inherited from parent commands

```plaintext
      --help   Show help for command
```

## Examples

```bash
# Using IDs
appcircle build download --profileId 8ad65c77-9ed8-4664-a6e1-4bf7032d33cd --branchId f416f868-5d1a-4464-8ff7-70ddb789aeba --commitId b96329d3-fd56-4030-8073-c13c61d288c4 --buildId 6528b1b9-359c-4589-b29d-c249a2f690ee

# Using names instead of IDs
appcircle build download --profile "Automation Variable" --branch "develop" --commitId b96329d3-fd56-4030-8073-c13c61d288c4 --buildId 6528b1b9-359c-4589-b29d-c249a2f690ee

# Mixed usage with custom path
appcircle build download --profile "Automation Variable" --branchId f416f868-5d1a-4464-8ff7-70ddb789aeba --commitId b96329d3-fd56-4030-8073-c13c61d288c4 --buildId 6528b1b9-359c-4589-b29d-c249a2f690ee --path ./artifacts
```
