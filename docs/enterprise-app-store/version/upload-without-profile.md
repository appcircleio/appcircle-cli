# `appcircle enterprise-app-store version upload-without-profile`

Upload enterprise app version without a profile.

```plaintext
appcircle enterprise-app-store version upload-without-profile [options]
```

## Options

```plaintext
      --app <string>           App path
```

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```

## Note on File Size Limits

- The maximum allowed file size for uploads is 3 GB
- When attempting to upload a file larger than this limit, the CLI will display an error message showing the actual file size and the limit
- The CLI supports paths with tilde (~) for referring to your home directory (e.g., ~/Downloads/app.apk)
