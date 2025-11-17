# `appcircle testing-distribution upload`

Upload your mobile app to selected distribution profile.

```plaintext
appcircle testing-distribution upload [options]
```

## Options

```plaintext
     --distProfileId <uuid>  Distribution profile ID
     --distProfile <string>  Distribution profile name (alternative to --distProfileId)
     --message <string>      Release notes
     --app <path>            App path
```
## Options inherited from parent commands

```plaintext
      --help   Show help for command
```

## Release Notes

- The `--message` parameter allows you to add release notes for your distribution
- Release notes are supported for both APK and AAB files
- In interactive mode, you can enter multi-line release notes:
  - Type your release notes line by line
  - Leave two blank lines to finish entering release notes
  - You can include line breaks and formatting in your release notes

## Note on File Size Limits

- The maximum allowed file size for uploads is 3 GB
- When attempting to upload a file larger than this limit, the CLI will display an error message showing the actual file size and the limit
- The CLI supports paths with tilde (~) for referring to your home directory (e.g., ~/Downloads/app.apk)
