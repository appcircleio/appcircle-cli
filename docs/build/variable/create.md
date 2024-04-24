# `appcircle build variable create`

Create a file or text environment variable.

```plaintext
appcircle build variable create [options]
```
## Examples

```plaintext
$ appcircle build variable create --variableGroupId "Variable Group ID" --type "text" --key "Key Name" --value "Key Value" --isSecret true

$ appcircle build variable create --variableGroupId "Variable Group ID" --type "file" --key "Key Name" --filePath "File Path"
```
         
## Options

```plaintext
      --variableGroupId <uuid>  Variable Group ID
      --type <string>           Type [file, text]
      --isSecret <boolean>      Secret
      --key <string>            Key Name
      --value <string>          Key Value
      --filePath <string>       File Path
```                       

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```
