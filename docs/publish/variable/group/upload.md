# `appcircle publish variable group upload`

Upload publish environment variables from JSON file to a variable group.

```plaintext
appcircle publish variable group upload [options]
```

## Examples

```plaintext
$ appcircle publish variable group upload --publishVariableGroupId "Variable Group ID" --filePath "/path/to/variables.json"
```
         
## Options

```plaintext
      --publishVariableGroupId <uuid>  Variable Group ID
      --filePath <string>             JSON file path
```                       

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```

## JSON File Format

The JSON file should be in the following format:

```json
[
  {
    "key": "VARIABLE_NAME",
    "value": "variable_value",
    "isSecret": false,
    "isFile": false,
    "id": "VARIABLE_NAME"
  },
  ...
]
``` 