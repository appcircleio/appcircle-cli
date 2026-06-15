# `appcircle signing-identity certificate upload`

Upload a new certificate bundle (.p12).

```plaintext
appcircle signing-identity certificate upload [options]
```

## Options

```plaintext
     --path <path>        Certificate path (required)

     --password <string>  Certificate password (optional - only needed if certificate is password-protected)
```

## Examples

```bash
# Upload a certificate without password
appcircle signing-identity certificate upload --path ./ios_distribution.p12

# Upload a password-protected certificate
appcircle signing-identity certificate upload --path ./ios_distribution.p12 --password "mypassword"
```

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```
