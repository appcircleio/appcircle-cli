# `appcircle publish profile publish-flow update`

Update an existing publish profile publish-flow by uploading a YAML file. The file is validated (component existence, step names, YAML format) before the flow is replaced.

```plaintext
appcircle publish profile publish-flow update [options]
```

## Options

```plaintext
      --platform <platform>      Platform (ios or android)
      --publishProfileId <uuid>  Publish profile ID
      --publishProfile <string>  Publish profile name (alternative to --publishProfileId)
      --publishFlowId <uuid>     Publish flow ID to update
      --filePath <path>          Path to the YAML file to upload
      --flowName <string>        [OPTIONAL] New name for the publish flow (defaults to the existing name)
```

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```
