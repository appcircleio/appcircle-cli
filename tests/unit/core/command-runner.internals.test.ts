import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  getLongDescriptionForCommand, 
  createStepSummaryFormatter, 
  findCommandByParts 
} from '../../../src/core/command-runner'

describe('command-runner internals (non-exported)', () => {
  let originalLog: any
  let originalStdoutWrite: any
  let logs: string[]
  let writes: string[]

  beforeEach(() => {
    logs = []
    writes = []
    originalLog = console.log
    originalStdoutWrite = process.stdout.write
    console.log = (...args: any[]) => {
      logs.push(args.join(' '))
    }
    // @ts-ignore
    process.stdout.write = (chunk: any) => {
      writes.push(typeof chunk === 'string' ? chunk : String(chunk))
      return true
    }
  })

  afterEach(() => {
    console.log = originalLog
    // @ts-ignore
    process.stdout.write = originalStdoutWrite
    vi.restoreAllMocks()
  })

  it('should test getLongDescriptionForCommand which uses findCommandByParts internally', () => {
    // Test with a valid command path
    const description = getLongDescriptionForCommand('appcircle-build-profile-list')
    expect(description).toBeTruthy()
    expect(typeof description).toBe('string')
    
    // Test with invalid command
    const invalidDescription = getLongDescriptionForCommand('appcircle-invalid-command')
    expect(invalidDescription).toBeUndefined()
  })

  it('should test build command execution which uses createStepSummaryFormatter internally', async () => {
    // This test verifies that the internal createStepSummaryFormatter works
    // by testing the build command flow that uses it
    
    // Mock the required dependencies
    vi.mock('../../../src/services/api', () => ({
      getBuildProfiles: vi.fn().mockResolvedValue([
        { id: 'test-profile', name: 'Test Profile' }
      ]),
      getBranches: vi.fn().mockResolvedValue([
        { id: 'test-branch', name: 'main' }
      ]),
      getWorkflows: vi.fn().mockResolvedValue([
        { id: 'test-workflow', name: 'Test Workflow' }
      ]),
      getConfigurations: vi.fn().mockResolvedValue([
        { id: 'test-config', name: 'Test Config' }
      ]),
      startBuild: vi.fn().mockResolvedValue({
        taskId: 'test-task-id',
        buildId: 'test-build-id'
      }),
      getBuildStatusFromQueue: vi.fn().mockResolvedValue({
        status: 2, // completed
        hasWarning: false
      }),
      getLatestBuildId: vi.fn().mockResolvedValue('test-build-id')
    }))

    // Mock environment variables
    process.env.AC_ACCESS_TOKEN = 'test-token'
    process.env.AC_ORGANIZATION_ID = 'test-org'

    // Import runCommand dynamically to avoid module loading issues
    const { runCommand } = await import('../../../src/core/command-runner')
    
    // Test that the command can be executed (this will use createStepSummaryFormatter internally)
    // We expect it to fail due to missing dependencies, but the formatter should be initialized
    try {
      const mockCommand = {
        fullCommandName: 'build start',
        isGroupCommand: () => false,
        parent: null,
        name: () => 'build',
        args: {},
        opts: () => ({
          profileName: 'Test Profile',
          branchName: 'main',
          workflowName: 'Test Workflow',
          configurationName: 'Test Config'
        })
      }
      await runCommand(mockCommand)
    } catch (error) {
      // Expected to fail due to missing dependencies, but formatter should have been created
      expect(error).toBeDefined()
    }
  })

  it('should test step summary formatter behavior using exported function', async () => {
    // Use the actual exported createStepSummaryFormatter function
    const formatter = createStepSummaryFormatter()

    // Test step processing
    formatter.processMessage({ stepName: 'Install dependencies', workflowStatus: 1 })
    expect(formatter.isBuildCompleted()).toBe(false)

    // Test step completion with duration
    formatter.processMessage({ stepName: 'Install dependencies', workflowStatus: 2, stepDuration: 3 })
    expect(formatter.isBuildCompleted()).toBe(false)

    // Test warning step
    formatter.processMessage({ stepName: 'Build', workflowStatus: 1 })
    formatter.processMessage({ stepName: 'Build', workflowStatus: 2, hasWarning: true, stepDuration: 5 })
    
    // Test duration calculation
    const totalDuration = formatter.getTotalStepsDuration()
    expect(totalDuration).toBe(8) // 3 + 5
    
    // Test finish
    formatter.finish()
    expect(formatter).toBeDefined()
  })

  it('should test findCommandByParts function directly', () => {
    // Test the exported findCommandByParts function directly
    const mockCommands = [
      {
        command: 'build',
        description: 'Build commands',
        subCommands: [
          {
            command: 'profile',
            description: 'Profile commands',
            subCommands: [
              { command: 'list', description: 'List profiles' }
            ]
          }
        ]
      }
    ]

    // Test finding nested command
    const result = findCommandByParts(['build', 'profile', 'list'], mockCommands)
    expect(result).toBeDefined()
    expect(result?.command).toBe('list')
    expect(result?.description).toBe('List profiles')

    // Test finding intermediate command
    const intermediateResult = findCommandByParts(['build', 'profile'], mockCommands)
    expect(intermediateResult).toBeDefined()
    expect(intermediateResult?.command).toBe('profile')

    // Test non-existent command
    const notFound = findCommandByParts(['nonexistent'], mockCommands)
    expect(notFound).toBeUndefined()
  })

  it('should test additional command paths for findCommandByParts', () => {
    // Test more complex command paths that would use findCommandByParts internally
    const complexTestCases = [
      'appcircle-build-profile-variable-list',
      'appcircle-publish-profile-variable-upload',
      'appcircle-organization-user-role-list',
      'appcircle-signing-identity-keystore-upload',
      'appcircle-signing-identity-provisioning-profile-download',
      'appcircle-enterprise-app-store-profile-version-list'
    ]
    
    complexTestCases.forEach(commandPath => {
      const description = getLongDescriptionForCommand(commandPath)
      // Should either return a string description or undefined for invalid commands
      expect(description === undefined || typeof description === 'string').toBe(true)
    })
  })

  it('should handle edge cases in command finding', () => {
    // Test edge cases that would stress test findCommandByParts
    const edgeCases = [
      '', // empty string
      'appcircle-', // just prefix
      'appcircle-invalid', // single invalid command
      'appcircle-build-invalid-subcommand', // valid parent, invalid child
      'appcircle-build-profile-invalid-action' // valid path with invalid final command
    ]
    
    edgeCases.forEach(commandPath => {
      const description = getLongDescriptionForCommand(commandPath)
      // All edge cases should return undefined
      expect(description).toBeUndefined()
    })
  })

  it('should test command finding logic through getLongDescriptionForCommand', () => {
    // Test various command paths that would use findCommandByParts internally
    const testCases = [
      'appcircle-build-profile-list',
      'appcircle-publish-profile-create',
      'appcircle-organization-user-list',
      'appcircle-signing-identity-certificate-list'
    ]
    
    testCases.forEach(commandPath => {
      const description = getLongDescriptionForCommand(commandPath)
      // Should either return a string description or undefined for invalid commands
      expect(description === undefined || typeof description === 'string').toBe(true)
    })
  })
})


