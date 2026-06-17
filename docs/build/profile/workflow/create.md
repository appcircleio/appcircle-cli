# `appcircle build profile workflow create`

Create a new build profile workflow by uploading a YAML file. The file is validated (component existence, step names, YAML format) before the workflow is created.

```plaintext
appcircle build profile workflow create [options]
```

## Options

```plaintext
      --profileId <uuid>       Build profile ID
      --profile <string>       Build profile name (alternative to --profileId)
      --workflowName <string>  Name for the new workflow
      --filePath <path>        Path to the YAML file to upload
```

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```
