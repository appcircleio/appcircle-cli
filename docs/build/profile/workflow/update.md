# `appcircle build profile workflow update`

Update an existing build profile workflow by uploading a YAML file. The file is validated (component existence, step names, YAML format) before the workflow is replaced.

```plaintext
appcircle build profile workflow update [options]
```

## Options

```plaintext
      --profileId <uuid>       Build profile ID
      --profile <string>       Build profile name (alternative to --profileId)
      --workflowId <uuid>      Workflow ID to update
      --filePath <path>        Path to the YAML file to upload
      --workflowName <string>  [OPTIONAL] New name for the workflow (defaults to the existing name)
```

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```
