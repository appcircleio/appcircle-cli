# `appcircle logout`

Log out from your Appcircle account and clear your stored authentication token.

```plaintext
appcircle logout
```

## Description

The `logout` command clears your stored authentication token locally. This is a local operation that doesn't make any API calls to the server.

## Examples

```bash
# Logout from your current session
appcircle logout
```

## Behavior

- Clears your stored `AC_ACCESS_TOKEN` from local configuration
- No API calls are made to the server
- You'll need to login again to perform authenticated operations
- If you're not currently logged in, you'll see an error message

## Interactive Mode

In interactive mode (`appcircle -i`), logout is available under the "Authentication (Login/Logout)" menu:
- Select "Authentication (Login/Logout)" from the main menu
- Choose "Logout" from the submenu

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```
