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

## Authentication Behavior

- If you're already logged in and try to login again, you'll see a "You are already logged in" message
- You must logout first before logging in with different credentials
- Use `appcircle logout` to clear your current authentication

## Interactive Mode

In interactive mode (`appcircle -i`), authentication options are grouped under "Authentication (Login/Logout)" menu:
- Select "Authentication (Login/Logout)" from the main menu
- Choose "Login" or "Logout" from the submenu
    - When choosing **Login**, you can authenticate using:
        - **API Key**
        - **Personal Access Token (PAT)**
- Use "⬅ Back" to navigate between menus

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```
