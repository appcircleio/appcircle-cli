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
  --path <string>    [OPTIONAL] The path for artifacts to be downloaded. Defaults to ~/Downloads if not specified.

  --commitId <uuid>  Commit ID of your build

  --buildId <uuid>   Build ID
```
## Options inherited from parent commands

```plaintext
      --help   Show help for command
```
