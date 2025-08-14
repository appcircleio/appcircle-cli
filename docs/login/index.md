# `appcircle login`

Log in to obtain your access token.

```plaintext
appcircle login [options]
```

## Subcommands

### `pat` - Login with Personal Access Token

```plaintext
appcircle login pat --token <token>
```

#### Options

```plaintext
      --token <token>   Personal Access Token
```

### `api-key` - Login with API Key

```plaintext
appcircle login api-key --name <name> --secret <secret> [--organization-id <id>]
```

#### Options

```plaintext
      --name <name>            API Key name
      --secret <secret>        API Key secret
      --organization-id <id>   Organization ID (optional)
```

## Examples

```bash
# Login with Personal Access Token
appcircle login pat --token "your-personal-access-token-here"

# Login with API Key
appcircle login api-key --name "my-api-key" --secret "my-secret"

# Login with API Key and specific organization
appcircle login api-key --name "my-api-key" --secret "my-secret" --organization-id "org-123"
```

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```
