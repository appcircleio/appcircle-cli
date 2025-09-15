# `appcircle enterprise-app-store version publish`

Publish enterprise app version.

```plaintext
appcircle enterprise-app-store version publish --entProfileId <uuid> --entVersionId <uuid> --summary <string> --releaseNotes <string> --publishType <number>
```

## Required Options

```plaintext
     --entProfileId <uuid>    Enterprise Profile ID

     --entVersionId <uuid>    App Version ID

     --summary <string>       Summary text

     --releaseNotes <string>  Release notes text

     --publishType <number>   Publish Type: 0=None, 1=Beta, 2=Live
```

## Examples

```bash
# Publish as Live version
appcircle enterprise-app-store version publish \
  --entProfileId "5a228cb7-8ba4-469a-9da9-cc2e4e9607f8" \
  --entVersionId "dee35ab4-cd4a-42e6-8eaa-feb6407abd31" \
  --summary "New major release" \
  --releaseNotes "Bug fixes and performance improvements" \
  --publishType 2

# Publish as Beta version
appcircle enterprise-app-store version publish \
  --entProfileId "5a228cb7-8ba4-469a-9da9-cc2e4e9607f8" \
  --entVersionId "dee35ab4-cd4a-42e6-8eaa-feb6407abd31" \
  --summary "Beta testing release" \
  --releaseNotes "New features for testing" \
  --publishType 1
```

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```
