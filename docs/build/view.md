# `appcircle build view`

View comprehensive details of a build, including its status, duration, and other relevant information.

```plaintext
appcircle build view [options]
```

## Options

```plaintext
  --profileId <uuid>   Build profile ID
  --profile <string>   Build profile name (alternative to --profileId)
  --branchId <uuid>    Branch ID
  --branch <string>    Branch name (alternative to --branchId)
  --commitId <uuid>    Commit ID of your build
  --buildId <uuid>     Build ID
```
## Options inherited from parent commands

```plaintext
      --help   Show help for command
```

## Examples

```bash
# Using IDs
appcircle build view --profileId 8ad65c77-9ed8-4664-a6e1-4bf7032d33cd --branchId f416f868-5d1a-4464-8ff7-70ddb789aeba --commitId b96329d3-fd56-4030-8073-c13c61d288c4 --buildId 6528b1b9-359c-4589-b29d-c249a2f690ee

# Using names instead of IDs
appcircle build view --profile "Automation Variable" --branch "develop" --commitId b96329d3-fd56-4030-8073-c13c61d288c4 --buildId 6528b1b9-359c-4589-b29d-c249a2f690ee

# Mixed usage (IDs and names)
appcircle build view --profile "Automation Variable" --branchId f416f868-5d1a-4464-8ff7-70ddb789aeba --commitId b96329d3-fd56-4030-8073-c13c61d288c4 --buildId 6528b1b9-359c-4589-b29d-c249a2f690ee
```
