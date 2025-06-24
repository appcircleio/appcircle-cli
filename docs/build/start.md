# `appcircle build start`

Start a new build.

```plaintext
appcircle build start [options]
```

## Options

```plaintext
  --profileId <uuid>        Build profile ID
  --profile <string>        Build profile name (alternative to --profileId)
  --branchId <uuid>         Branch ID
  --branch <string>         Branch name (alternative to --branchId)
  --commitId <uuid>         Commit ID [Optional]
  --commitHash <string>     Commit hash (alternative to --commitId) [Optional]
  --configurationId <uuid>  Configuration ID [Optional]
  --configuration <string>  Configuration name (alternative to --configurationId) [Optional]
  --workflowId <uuid>       Workflow ID
  --workflow <string>       Workflow name (alternative to --workflowId)
```
## Options inherited from parent commands

```plaintext
      --help   Show help for command
```

## Examples

```bash
# Using IDs
appcircle build start --profileId 8ad65c77-9ed8-4664-a6e1-4bf7032d33cd --branchId f416f868-5d1a-4464-8ff7-70ddb789aeba --workflowId 2b94f624-2040-4a96-8692-ab73c5b0f746

# Using names instead of IDs
appcircle build start --profile "Automation Variable" --branch "develop" --workflow "Default Push Workflow"

# Mixed usage (IDs and names)
appcircle build start --profile "Automation Variable" --branchId f416f868-5d1a-4464-8ff7-70ddb789aeba --workflow "Default Push Workflow" --configuration "Default Configuration"
```
