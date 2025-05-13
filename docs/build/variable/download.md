# `appcircle build variable download`

Download environment variables as JSON

```plaintext
appcircle build variable download [options]
```

## Examples

```plaintext
$ appcircle build variable download --variableGroupId "Variable Group ID"

$ appcircle build variable download --variableGroupId "Variable Group ID" --path "/path/to/save"
```
         
## Options

```plaintext
      --variableGroupId <uuid>  Variable Groups ID
      --path <string>           [OPTIONAL] The path for JSON file to be downloaded (Defaults to the current directory)
```                       

## Options inherited from parent commands

```plaintext
      --help   Show help for command
``` 