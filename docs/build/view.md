# `appcircle build view`

View comprehensive details of a build, including its status, duration, and other relevant information.

```plaintext
appcircle build view [options]
```

## Options

```plaintext
  --profileId <uuid>    Build profile ID
  --profile <string>    Build profile name (alternative to --profileId)
  --branchId <uuid>     Branch ID
  --branch <string>     Branch name (alternative to --branchId)
  --commitId <uuid>     Commit ID of your build
  --commitHash <string> Git commit hash (alternative to --commitId)
  --buildId <uuid>      Build ID
```

## Description

View detailed information about a specific build. You can identify the commit using either:
- Appcircle's commit ID (`--commitId`), or
- Git commit hash (`--commitHash`)

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```

## Examples

```bash
# Using Appcircle commit ID
appcircle build view --profileId 8ad65c77-9ed8-4664-a6e1-4bf7032d33cd --branchId f416f868-5d1a-4464-8ff7-70ddb789aeba --commitId b96329d3-fd56-4030-8073-c13c61d288c4 --buildId 6528b1b9-359c-4589-b29d-c249a2f690ee

# Using Git commit hash instead of commit ID
appcircle build view --profile "Automation Variable" --branch "develop" --commitHash a1b2c3d4e5f6 --buildId 6528b1b9-359c-4589-b29d-c249a2f690ee

# Mixed usage (names and commit ID)
appcircle build view --profile "Automation Variable" --branchId f416f868-5d1a-4464-8ff7-70ddb789aeba --commitId b96329d3-fd56-4030-8073-c13c61d288c4 --buildId 6528b1b9-359c-4589-b29d-c249a2f690ee

# Using commit hash with profile and branch names
appcircle build view --profile "My iOS Project" --branch "main" --commitHash a1b2c3d4 --buildId 6528b1b9-359c-4589-b29d-c249a2f690ee
```
