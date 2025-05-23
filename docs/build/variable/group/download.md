# `appcircle build variable group download`

Download Build environment variables as a JSON file

```plaintext
appcircle build variable group download [options]
```

## Examples

```plaintext
$ appcircle build variable group download --variableGroupId "Variable Group ID"

$ appcircle build variable group download --variableGroupId "Variable Group ID" --path "/path/to/save"
```
         
## Options

```plaintext
      --variableGroupId <uuid>  Variable Group ID
      --path <string>           [OPTIONAL] The path for JSON file to be downloaded (Defaults to the current directory)
```                       

## Options inherited from parent commands

```plaintext
      --help   Show help for command
``` 