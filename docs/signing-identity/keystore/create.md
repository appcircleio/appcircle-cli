# `appcircle signing-identity keystore create`

Generate a new keystore.

```plaintext
appcircle signing-identity keystore create [options]
```

## Examples

```plaintext
$ appcircle signing-identity keystore create --name "Keystore name" --password "Keystore password" --alias "Alias" --aliasPassword "Alias password" --validity "2"
```

## Options

```plaintext
     --name <string>           Keystore name

     --password <string>       Keystore password (must be at least 6 characters)

     --alias <string>          Alias

     --aliasPassword <string>  Alias password (must be at least 6 characters)

     --validity <string>       Validity (Years)
```

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```
