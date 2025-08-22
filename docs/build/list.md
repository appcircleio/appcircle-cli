# `appcircle build list`

Get list of builds of a commit.

```plaintext
appcircle build list [options]
```

## Options

```plaintext
  --profileId <uuid>   Build profile ID
  --profile <string>   Build profile name (alternative to --profileId)
  --branchId <uuid>    Branch ID
  --branch <string>    Branch name (alternative to --branchId)
  --commitId <uuid>    Commit ID
```
## Options inherited from parent commands

```plaintext
      --help   Show help for command
```

## Examples

```bash
# Using IDs
appcircle build list --profileId 8ad65c77-9ed8-4664-a6e1-4bf7032d33cd --branchId f416f868-5d1a-4464-8ff7-70ddb789aeba --commitId b96329d3-fd56-4030-8073-c13c61d288c4

# Using names instead of IDs
appcircle build list --profile "Automation Variable" --branch "develop" --commitId b96329d3-fd56-4030-8073-c13c61d288c4

# Mixed usage (IDs and names)
appcircle build list --profile "Automation Variable" --branchId f416f868-5d1a-4464-8ff7-70ddb789aeba --commitId b96329d3-fd56-4030-8073-c13c61d288c4
```
