# `appcircle build start`

Start a new build.

```plaintext
appcircle build start [options]
```

## Options

### Required Parameters
```plaintext
  --profileId <uuid>        Build profile ID
  --profile <string>        Build profile name (alternative to --profileId)
  --workflowId <uuid>       Workflow ID
  --workflow <string>       Workflow name (alternative to --workflowId)
```

### Conditional Parameters
```plaintext
  --branchId <uuid>         Branch ID (required when --commitId is not provided)
  --branch <string>         Branch name (alternative to --branchId)
  --commitId <uuid>         Commit ID (required when --branchId is not provided)
  --commitHash <string>     Commit hash (alternative to --commitId)
```

### Optional Parameters
```plaintext
  --configurationId <uuid>  Configuration ID
  --configuration <string>  Configuration name (alternative to --configurationId)
  --no-wait                 Don't wait for build completion, return immediately with task info
  --download-logs           Automatically download build logs after completion
  --download-artifacts      Automatically download build artifacts after completion
  --path <string>           Download path for logs and artifacts (default: ~/Downloads)
```

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```

## Parameter Logic

### Profile Selection
- **Required**: Either `--profileId` or `--profile` must be provided
- **Example**: `--profileId 550e8400-e29b-41d4-a716-446655440000` or `--profile "My iOS Project"`

### Workflow Selection
- **Required**: Either `--workflowId` or `--workflow` must be provided
- **Example**: `--workflowId 6ba7b811-9dad-11d1-80b4-00c04fd430c8` or `--workflow "Default Push Workflow"`

### Commit vs Branch Selection
You must provide either commit information OR branch information:

#### Option 1: Specify Commit (Branch becomes optional)
```bash
# Using commit ID
appcircle build start --profileId <uuid> --commitId <uuid> --workflowId <uuid>

# Using commit hash
appcircle build start --profileId <uuid> --commitHash <hash> --workflowId <uuid>
```

#### Option 2: Specify Branch (uses latest commit from branch)
```bash
# Using branch ID
appcircle build start --profileId <uuid> --branchId <uuid> --workflowId <uuid>

# Using branch name
appcircle build start --profileId <uuid> --branch "main" --workflowId <uuid>
```

### Configuration Selection
- **Optional**: If not provided, uses the first available configuration for the profile
- **Example**: `--configurationId <uuid>` or `--configuration "Debug Configuration"`

## Usage Examples

### Basic Usage

#### 1. Build with Specific Commit
```bash
appcircle build start --profileId 550e8400-e29b-41d4-a716-446655440000 --commitId 6ba7b812-9dad-11d1-80b4-00c04fd430c8 --workflowId 6ba7b811-9dad-11d1-80b4-00c04fd430c8
```

#### 2. Build with Branch (uses latest commit)
```bash
appcircle build start --profileId 550e8400-e29b-41d4-a716-446655440000 --branchId 6ba7b810-9dad-11d1-80b4-00c04fd430c8 --workflowId 6ba7b811-9dad-11d1-80b4-00c04fd430c8
```

#### 3. Build with Names Instead of IDs
```bash
appcircle build start --profile "My iOS Project" --branch "main" --workflow "Default Push Workflow"
```

### Advanced Usage

#### 4. Build with Configuration
```bash
appcircle build start --profileId <uuid> --commitId <uuid> --configurationId <uuid> --workflowId <uuid>
```

#### 5. Automation (No Wait)
```bash
appcircle build start --profileId <uuid> --commitId <uuid> --workflowId <uuid> --no-wait
```

#### 6. Build with Auto-Download
```bash
appcircle build start --profileId <uuid> --commitId <uuid> --workflowId <uuid> --download-logs --download-artifacts
```

#### 7. Build with Custom Download Path
```bash
appcircle build start --profileId <uuid> --commitId <uuid> --workflowId <uuid> --download-artifacts --path "/custom/path"
```

#### 8. Mixed Usage (IDs and Names)
```bash
appcircle build start --profile "My Android App" --branchId 6ba7b810-9dad-11d1-80b4-00c04fd430c8 --workflow "Default Push Workflow"
```

## Common Scenarios

### Scenario 1: Build Latest Commit from Branch
```bash
# When you want to build the latest commit from a specific branch
appcircle build start --profileId <uuid> --branchId <uuid> --workflowId <uuid>
```

### Scenario 2: Build Specific Commit
```bash
# When you want to build a specific commit (branch info not needed)
appcircle build start --profileId <uuid> --commitId <uuid> --workflowId <uuid>
```

### Scenario 3: Automation Pipeline
```bash
# For CI/CD pipelines where you don't want to wait for completion
appcircle build start --profileId <uuid> --commitId <uuid> --workflowId <uuid> --no-wait
```

### Scenario 4: Build with Artifacts
```bash
# When you need logs and artifacts after build completion
appcircle build start --profileId <uuid> --commitId <uuid> --workflowId <uuid> --download-logs --download-artifacts
```

## Notes

- **Commit vs Branch**: When you provide `--commitId`, the system doesn't need branch information since the commit is already specified. When you provide `--branchId`, the system automatically uses the latest commit from that branch.

- **Configuration**: If `--configurationId` is not provided, the system uses the first available configuration for the profile.

- **No Wait**: The `--no-wait` parameter is useful for automation scenarios where you don't want to wait for build completion. The command returns immediately with task information.

- **Auto Download**: The `--download-logs` and `--download-artifacts` parameters automatically download files after build completion. Use `--path` to specify a custom download location.

## Learn More

- Use `appcircle build profile list` to get available profiles with their UUIDs and names
- Use `appcircle build profile branch list --profileId <uuid>` to get available branches
- Use `appcircle build profile workflows --profileId <uuid>` to get available workflows
