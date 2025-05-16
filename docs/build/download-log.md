# `appcircle build download-log`

Download build logs to the specified directory.

```plaintext
appcircle build download-log [options]
```

## Description

This command downloads build logs to your computer. You can download logs using two different methods:

1. Using `taskId` (preferred method)
2. Using `commitId` and `buildId` (alternative method)

When downloading logs, the CLI automatically checks if logs are ready at 5-second intervals for up to 2 minutes.

## Options

```plaintext
  --path <string>     [OPTIONAL] Path where logs will be downloaded. Defaults to current directory or Downloads folder

  --taskId <uuid>     [METHOD 1] Task ID for the build process

  --commitId <uuid>   [METHOD 2] Commit ID

  --buildId <uuid>    [METHOD 2] Build ID
```

## Features

- User-friendly animation is displayed while build logs are being prepared
- Automatically switches to alternative download methods if the primary method fails
- Logs are saved with descriptive filenames: `build-task-{taskId}-log.txt` or `{buildId}-log.txt`
- Full file path is displayed to easily find log files

## Options inherited from parent commands

```plaintext
      --help   Show help for command
``` 

## Examples

```plaintext
# Download logs using Task ID (preferred method)
appcircle build download-log --taskId="1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p"

# Download logs using Commit ID and Build ID
appcircle build download-log --commitId="1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p" --buildId="7q8r9s0t-1u2v-3w4x-5y6z-7a8b9c0d1e2f"

# Download to a specific directory
appcircle build download-log --taskId="1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p" --path="/Users/username/Downloads"
``` 