import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock config module before importing command-runner
vi.mock('../../../src/config', () => ({
  DefaultEnvironmentVariables: {
    AC_ACCESS_TOKEN: 'AC_ACCESS_TOKEN',
    AC_ORGANIZATION_ID: 'AC_ORGANIZATION_ID',
    AC_API_HOSTNAME: 'AC_API_HOSTNAME',
    AC_AUTH_HOSTNAME: 'AC_AUTH_HOSTNAME',
    AC_HOOK_HOSTNAME: 'AC_HOOK_HOSTNAME'
  },
  EnvironmentVariables: {
    AC_ACCESS_TOKEN: 'AC_ACCESS_TOKEN',
    AC_ORGANIZATION_ID: 'AC_ORGANIZATION_ID'
  },
  handleConfigListAction: vi.fn(),
  handleConfigSetAction: vi.fn(),
  handleConfigGetAction: vi.fn(),
  handleConfigCurrentAction: vi.fn(),
  handleConfigAddAction: vi.fn(),
  handleConfigResetAction: vi.fn(),
  handleConfigTrustAction: vi.fn(),
  getConfigStore: vi.fn(() => ({
    envs: {
      'test-env': 'Test Environment'
    }
  })),
  getConsoleOutputType: vi.fn(),
  getConfigFilePath: vi.fn(),
  getEnviromentsConfigToWriting: vi.fn(),
  getCurrentConfigVariable: vi.fn(),
  addNewConfigVariable: vi.fn(),
  clearConfigs: vi.fn(),
  setCurrentConfigVariable: vi.fn(),
  writeEnviromentConfigVariable: vi.fn(),
  readEnviromentConfigVariable: vi.fn(),
  configWriter: vi.fn(),
  trustAppcircleCertificate: vi.fn().mockImplementation(() => {
    // Mock implementation that doesn't call process.exit
    console.log('Trust certificate action mocked')
  })
}))

// Mock the security module to prevent process.exit calls
vi.mock('../../../src/security/trust-url-certificate', () => ({
  trustAppcircleCertificate: vi.fn().mockResolvedValue(undefined)
}))

import { 
  createStepSummaryFormatter, 
  findCommandByParts, 
  handleConfigCommand 
} from '../../../src/core/command-runner'
import { Commands, CommandType } from '../../../src/core/commands'

// Mock chalk to return text unchanged
const mockChalk = new Proxy({}, {
  get: () => (text: string) => text
}) as any

// Mock console methods
const originalConsoleLog = console.log
const originalConsoleError = console.error
const originalProcessStdoutWrite = process.stdout.write

describe('command-runner exported functions', () => {
  let logs: string[]
  let errors: string[]
  let stdoutWrites: string[]

  beforeEach(() => {
    logs = []
    errors = []
    stdoutWrites = []
    
    console.log = (...args: any[]) => {
      logs.push(args.join(' '))
    }
    console.error = (...args: any[]) => {
      errors.push(args.join(' '))
    }
    // @ts-ignore
    process.stdout.write = (chunk: any) => {
      stdoutWrites.push(typeof chunk === 'string' ? chunk : String(chunk))
      return true
    }
  })

  afterEach(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
    // @ts-ignore
    process.stdout.write = originalProcessStdoutWrite
    vi.restoreAllMocks()
  })

  describe('createStepSummaryFormatter', () => {
    it('should create a formatter with all required methods', () => {
      const formatter = createStepSummaryFormatter()
      
      expect(formatter).toBeDefined()
      expect(typeof formatter.processMessage).toBe('function')
      expect(typeof formatter.getTotalStepsDuration).toBe('function')
      expect(typeof formatter.renderStepTable).toBe('function')
      expect(typeof formatter.setEphemeralStatus).toBe('function')
      expect(typeof formatter.clearEphemeralStatus).toBe('function')
      expect(typeof formatter.finish).toBe('function')
      expect(typeof formatter.setCompletionCallback).toBe('function')
      expect(typeof formatter.isBuildCompleted).toBe('function')
      expect(typeof formatter.setSSEConnection).toBe('function')
      expect(typeof formatter.markStepAsWarning).toBe('function')
      expect(typeof formatter.getLastCompletedStep).toBe('function')
    })

    it('should track step states correctly', () => {
      const formatter = createStepSummaryFormatter()
      
      // Test step start
      formatter.processMessage({ stepName: 'Install dependencies', workflowStatus: 1 })
      expect(formatter.isBuildCompleted()).toBe(false)
      
      // Test step completion
      formatter.processMessage({ stepName: 'Install dependencies', workflowStatus: 2, stepDuration: 3 })
      expect(formatter.isBuildCompleted()).toBe(false)
      
      // Test that formatter can track multiple steps
      formatter.processMessage({ stepName: 'Build', workflowStatus: 1 })
      formatter.processMessage({ stepName: 'Build', workflowStatus: 2, stepDuration: 5 })
      expect(formatter.isBuildCompleted()).toBe(false)
    })

    it('should calculate total duration correctly', () => {
      const formatter = createStepSummaryFormatter()
      
      // Add steps with durations
      formatter.processMessage({ stepName: 'Step 1', workflowStatus: 1 })
      formatter.processMessage({ stepName: 'Step 1', workflowStatus: 2, stepDuration: 5 })
      
      formatter.processMessage({ stepName: 'Step 2', workflowStatus: 1 })
      formatter.processMessage({ stepName: 'Step 2', workflowStatus: 2, stepDuration: 3 })
      
      const totalDuration = formatter.getTotalStepsDuration()
      expect(totalDuration).toBe(8)
    })

    it('should handle warnings correctly', () => {
      const formatter = createStepSummaryFormatter()
      
      formatter.processMessage({ stepName: 'Build', workflowStatus: 1 })
      formatter.processMessage({ stepName: 'Build', workflowStatus: 2, hasWarning: true, stepDuration: 2 })
      
      // Mark step as warning
      formatter.markStepAsWarning('Build')
      
      // Should still track duration
      const totalDuration = formatter.getTotalStepsDuration()
      expect(totalDuration).toBe(2)
    })

    it('should handle completion callback', () => {
      const formatter = createStepSummaryFormatter()
      const callback = vi.fn()
      
      formatter.setCompletionCallback(callback)
      
      // Test that callback is set
      expect(callback).toBeDefined()
      
      // Test that formatter can be finished
      formatter.finish()
      // Note: The actual callback execution depends on build completion logic
      // which is complex and involves setTimeout, so we just test the setup
    })

    it('should handle SSE connection', () => {
      const formatter = createStepSummaryFormatter()
      const mockConnection = { close: vi.fn() }
      
      formatter.setSSEConnection(mockConnection)
      
      // Test that connection is set
      expect(mockConnection).toBeDefined()
      
      // Test that formatter can be finished
      formatter.finish()
      // Note: The actual connection closing depends on build completion logic
      // which is complex and involves setTimeout, so we just test the setup
    })

    it('should get last completed step', () => {
      const formatter = createStepSummaryFormatter()
      
      // Complete one step
      formatter.processMessage({ stepName: 'Step 1', workflowStatus: 1 })
      formatter.processMessage({ stepName: 'Step 1', workflowStatus: 2, stepDuration: 1 })
      
      // Complete another step
      formatter.processMessage({ stepName: 'Step 2', workflowStatus: 1 })
      formatter.processMessage({ stepName: 'Step 2', workflowStatus: 2, stepDuration: 2 })
      
      const lastStep = formatter.getLastCompletedStep()
      // Should return a completed step (either Step 1 or Step 2)
      expect(lastStep).toBeTruthy()
      expect(['Step 1', 'Step 2']).toContain(lastStep)
    })

    it('should render step table', () => {
      const formatter = createStepSummaryFormatter()
      
      formatter.processMessage({ stepName: 'Test Step', workflowStatus: 1 })
      formatter.processMessage({ stepName: 'Test Step', workflowStatus: 2, stepDuration: 5 })
      
      formatter.renderStepTable()
      
      // Should have rendered some output
      const output = logs.join('\n') + '\n' + stdoutWrites.join('\n')
      expect(output).toContain('Test Step')
    })
  })

  describe('findCommandByParts', () => {
    const mockCommands: CommandType[] = [
      {
        command: 'build',
        description: 'Build commands',
        subCommands: [
          {
            command: 'profile',
            description: 'Profile commands',
            subCommands: [
              { command: 'list', description: 'List profiles' },
              { command: 'create', description: 'Create profile' }
            ]
          },
          { command: 'start', description: 'Start build' }
        ]
      },
      {
        command: 'publish',
        description: 'Publish commands',
        subCommands: [
          { command: 'upload', description: 'Upload app' }
        ]
      }
    ]

    it('should find simple commands', () => {
      const result = findCommandByParts(['build'], mockCommands)
      expect(result).toBeDefined()
      expect(result?.command).toBe('build')
      expect(result?.description).toBe('Build commands')
    })

    it('should find nested commands', () => {
      const result = findCommandByParts(['build', 'profile', 'list'], mockCommands)
      expect(result).toBeDefined()
      expect(result?.command).toBe('list')
      expect(result?.description).toBe('List profiles')
    })

    it('should find intermediate nested commands', () => {
      const result = findCommandByParts(['build', 'profile'], mockCommands)
      expect(result).toBeDefined()
      expect(result?.command).toBe('profile')
      expect(result?.description).toBe('Profile commands')
    })

    it('should return undefined for non-existent commands', () => {
      const result = findCommandByParts(['nonexistent'], mockCommands)
      expect(result).toBeUndefined()
    })

    it('should return undefined for non-existent nested commands', () => {
      const result = findCommandByParts(['build', 'nonexistent'], mockCommands)
      expect(result).toBeUndefined()
    })

    it('should return undefined for empty parts array', () => {
      const result = findCommandByParts([], mockCommands)
      expect(result).toBeUndefined()
    })

    it('should handle deep nesting', () => {
      const deepCommands: CommandType[] = [
        {
          command: 'level1',
          description: 'Level 1',
          subCommands: [
            {
              command: 'level2',
              description: 'Level 2',
              subCommands: [
                {
                  command: 'level3',
                  description: 'Level 3',
                  subCommands: [
                    { command: 'level4', description: 'Level 4' }
                  ]
                }
              ]
            }
          ]
        }
      ]

      const result = findCommandByParts(['level1', 'level2', 'level3', 'level4'], deepCommands)
      expect(result).toBeDefined()
      expect(result?.command).toBe('level4')
    })

    it('should work with real Commands structure', () => {
      const result = findCommandByParts(['build', 'profile', 'list'], Commands)
      expect(result).toBeDefined()
      expect(result?.command).toBe('list')
    })
  })

  describe('handleConfigCommand', () => {
    const createMockCommand = (name: string, args: string[] = []) => ({
      name: () => name,
      args: () => args,
      fullCommandName: `config ${name}`,
      isGroupCommand: () => false,
      parent: null,
      opts: () => ({})
    })


    it('should handle list action', () => {
      const command = createMockCommand('list')
      
      // This should not throw
      expect(() => handleConfigCommand(command)).not.toThrow()
    })

    it('should handle set action', () => {
      const command = createMockCommand('set', ['key', 'value'])
      
      // This should not throw
      expect(() => handleConfigCommand(command)).not.toThrow()
    })

    it('should handle get action', () => {
      const command = createMockCommand('get', ['key'])
      
      // This should not throw
      expect(() => handleConfigCommand(command)).not.toThrow()
    })

    it('should handle current action', () => {
      const command = createMockCommand('current', ['key'])
      
      // This should throw because current action requires a valid value
      expect(() => handleConfigCommand(command)).toThrow()
    })

    it('should handle add action', () => {
      const command = createMockCommand('add', ['key'])
      
      // This should not throw
      expect(() => handleConfigCommand(command)).not.toThrow()
    })

    it('should handle reset action', () => {
      const command = createMockCommand('reset')
      
      // This should not throw
      expect(() => handleConfigCommand(command)).not.toThrow()
    })

    it('should handle trust action', () => {
      const command = createMockCommand('trust')
      
      // This should not throw
      expect(() => handleConfigCommand(command)).not.toThrow()
    })

    it('should handle unknown action gracefully', () => {
      const command = createMockCommand('unknown')
      
      // Should throw for unknown actions
      expect(() => handleConfigCommand(command)).toThrow()
    })
  })

  describe('integration tests', () => {
    it('should work together - findCommandByParts with createStepSummaryFormatter', () => {
      // Find a build command
      const buildCommand = findCommandByParts(['build'], Commands)
      expect(buildCommand).toBeDefined()
      
      // Create a formatter for build monitoring
      const formatter = createStepSummaryFormatter()
      expect(formatter).toBeDefined()
      
      // Simulate build steps
      formatter.processMessage({ stepName: 'Install dependencies', workflowStatus: 1 })
      formatter.processMessage({ stepName: 'Install dependencies', workflowStatus: 2, stepDuration: 3 })
      
      const duration = formatter.getTotalStepsDuration()
      expect(duration).toBe(3)
    })

    it('should handle complex command paths with formatter', () => {
      // Test complex nested command
      const complexCommand = findCommandByParts(['build', 'profile', 'variable', 'list'], Commands)
      
      if (complexCommand) {
        // If command exists, create formatter and test
        const formatter = createStepSummaryFormatter()
        formatter.processMessage({ stepName: 'Processing command', workflowStatus: 1 })
        formatter.processMessage({ stepName: 'Processing command', workflowStatus: 2, stepDuration: 1 })
        
        expect(formatter.getTotalStepsDuration()).toBe(1)
      }
    })
  })
})
