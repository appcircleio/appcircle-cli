# `appcircle publish profile version upload`

Upload a new version to given publish profile.

```plaintext
appcircle publish profile version upload [options]
```

## Options

```plaintext
     --platform <string>        Platform (ios/android)
     --publishProfileId <uuid>  Publish profile ID
     --app <path>               App path
     --markAsRc <boolean>       Mark binary as release candidate automatically. [OPTIONAL] (default: false)
     --summary <string>         Release Notes (To add a release note to the app version, you need to mark the version as a release candidate.) [OPTIONAL]
```
## Options inherited from parent commands

```plaintext
      --help   Show help for command
```

## Note on File Size Limits

- The maximum allowed file size for uploads is 3 GB
- When attempting to upload a file larger than this limit, the CLI will display an error message showing the actual file size and the limit
- The CLI supports paths with tilde (~) for referring to your home directory (e.g., ~/Downloads/app.apk)
