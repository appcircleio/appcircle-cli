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
  --branchId <uuid>        Appcircle branch ID,. Required when --commitId is not provided
  --branch <string>         Git branch name (alternative to --branchId). Required when --commitId is not provided
  --commitId <uuid>         Appcircle commit ID . Required when --branchId is not provided
  --commitHash <string>     Git commit hash (alternative to --commitId). Required when --branchId is not provided
```

### Optional Parameters
```plaintext
  --configurationId <uuid>  Configuration ID
  --configuration <string>  Configuration name (alternative to --configurationId)
  --no-wait                 Don't wait for build completion, return immediately with task info
                            Note: Incompatible with monitoring modes (--monitor)
  --download-logs           Automatically download build logs after completion
  --download-artifacts      Automatically download build artifacts after completion
  --path <string>           Download path for logs and artifacts (default: ~/Downloads)
  --monitor <mode>          Build monitoring preference: none, summary (default), steps, or verbose
                            Note: Ignored when --no-wait is used
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

### Monitor Mode Selection
The `--monitor` parameter controls how the build process is monitored and displayed:

- **`none`**: No monitoring. Just return Task/Build ID and exit immediately
- **`summary`** (default): Wait until completion, show final status + total duration in one line
- **`steps`**: Wait until completion, show step-by-step progress (started/finished) minimally
- **`verbose`**: Wait until completion, stream detailed logs line by line in real-time

**Real-time Log Features:**
- All monitor modes (except `none`) provide real-time log streaming from the build process
- Logs are displayed as they are generated, providing immediate feedback on build progress
- The system automatically handles log formatting and step transitions for better readability

**Backward Compatibility:**
- The legacy `--execution-mode` parameter is still supported for backward compatibility
- Legacy modes are automatically mapped to new monitor modes:
  - `normal` → `summary`
  - `detailed` → `verbose`
  - `step-summary` → `steps`
  - `skip` → `none`

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

#### 9. Build with Different Execution Modes
```bash
# Normal mode (default) - standard monitoring with real-time logs
appcircle build start --profileId <uuid> --commitId <uuid> --workflowId <uuid>

# Verbose mode - enhanced monitoring with detailed progress tracking
appcircle build start --profileId <uuid> --commitId <uuid> --workflowId <uuid> --monitor verbose

# Steps mode - clean table showing only steps and durations
appcircle build start --profileId <uuid> --commitId <uuid> --workflowId <uuid> --monitor steps

# None mode - return task ID immediately without monitoring
appcircle build start --profileId <uuid> --commitId <uuid> --workflowId <uuid> --monitor none
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

### Scenario 5: Real-time Build Monitoring
```bash
# For development - watch build progress in real-time with detailed logs
appcircle build start --profileId <uuid> --commitId <uuid> --workflowId <uuid> --monitor verbose

# For CI/CD - get clean step summary without verbose logs
appcircle build start --profileId <uuid> --commitId <uuid> --workflowId <uuid> --monitor steps
```

## Notes

- **Commit vs Branch**: When you provide `--commitId`, the system doesn't need branch information since the commit is already specified. When you provide `--branchId`, the system automatically uses the latest commit from that branch.

- **Configuration**: If `--configurationId` is not provided, the system uses the first available configuration for the profile.

- **No Wait**: The `--no-wait` parameter is useful for automation scenarios where you don't want to wait for build completion. The command returns immediately with task information.

- **Parameter Compatibility**: The `--no-wait` flag is incompatible with monitoring modes (`--monitor verbose`, `--monitor steps`, `--monitor summary`). If both are specified, the CLI will display a warning and automatically ignore the monitoring mode, treating the command as if `--monitor none` was specified. For automation scenarios, it's recommended to explicitly use `--no-wait` without any monitoring flags, or use `--no-wait --monitor none` for clarity.

- **Auto Download**: The `--download-logs` and `--download-artifacts` parameters automatically download files after build completion. Use `--path` to specify a custom download location.

- **Monitoring Preferences**: The `--monitor` parameter allows you to control how build progress is displayed. The default `summary` mode provides real-time build status and duration, while `verbose` mode offers full verbose log streaming, `steps` shows step-by-step progress, and `none` returns only the task ID.

- **Real-time Logs**: All monitor modes (except `none`) provide real-time log streaming, allowing you to monitor build progress as it happens. The system automatically formats logs and handles step transitions for better readability.

- **Backward Compatibility**: The legacy `--execution-mode` parameter is still supported and automatically maps to the new monitor modes for seamless migration.

## Learn More

- Use `appcircle build profile list` to get available profiles with their UUIDs and names
- Use `appcircle build profile branch list --profileId <uuid>` to get available branches
- Use `appcircle build profile workflows --profileId <uuid>` to get available workflows
