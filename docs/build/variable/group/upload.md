# `appcircle build variable group upload`

Upload environment variables from JSON file to a variable group.

```plaintext
appcircle build variable group upload [options]
```

## Examples

```plaintext
$ appcircle build variable group upload --variableGroupId "Variable Group ID" --filePath "/path/to/variables.json"
```
         
## Options

```plaintext
      --variableGroupId <uuid>  Variable Group ID
      --filePath <string>       JSON file path
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