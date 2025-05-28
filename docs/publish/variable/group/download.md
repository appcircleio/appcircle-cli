# `appcircle publish variable group download`

Download Publish environment variables as a JSON file

```plaintext
appcircle publish variable group download [options]
```

## Examples

```plaintext
$ appcircle publish variable group download --publishVariableGroupId "Variable Group ID"

$ appcircle publish variable group download --publishVariableGroupId "Variable Group ID" --path "/path/to/save"
```
         
## Options

```plaintext
      --publishVariableGroupId <uuid>  Variable Group ID
      --path <string>                  [OPTIONAL] The path for JSON file to be downloaded (Defaults to the current directory)
```                       

## Options inherited from parent commands

```plaintext
      --help   Show help for command
``` 