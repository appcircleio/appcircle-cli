# `appcircle testing-distribution profile settings auto-send`

Select the test groups for automated distribution.

```plaintext
appcircle testing-distribution profile settings auto-send [options]
```

## Examples

```plaintext
$ appcircle testing-distribution profile settings auto-send --distProfileId "Distribution profile ID" --testingGroupIds "testingGroupId1 testingGroupId2"
$ appcircle testing-distribution profile settings auto-send --distProfile "Beta Testing" --testingGroups "QA Team,Beta Testers"
$ appcircle testing-distribution profile settings auto-send --distProfile "Production" --testingGroups "My Testers"
```

## Options

```plaintext
      --distProfileId <uuid>      Distribution profile ID
      --distProfile <string>      Distribution profile name (alternative to --distProfileId)
      --testingGroupIds <string>  Testing group IDs for automated distribution
      --testingGroups <string>    Testing group names for automated distribution (alternative to --testingGroupIds)
```

## Options inherited from parent commands

```plaintext
      --help   Show help for command
```
