# `appcircle build download-log`

Download build log to the given directory on your machine.

```plaintext
appcircle build download-log [options]
```

## Options

```plaintext
  --path <string>    [OPTIONAL] The path for log to be downloaded. Defaults to the current directory

  --taskId <uuid>    Task ID of your build (preferred method)

  --commitId <uuid>  Commit ID of your build

  --buildId <uuid>   Build ID
```

## Description

This command downloads build logs using either a Task ID (preferred) or a Commit ID and Build ID combination. When using the Task ID method, the CLI automatically waits for logs to be ready, checking at 5-second intervals for up to 2 minutes.

The downloaded log file will be saved as `build-task-{taskId}-log.txt` or `{buildId}-log.txt` depending on the method used.

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
``` 