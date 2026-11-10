import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

const state = vi.hoisted(() => ({
  outputType: 'plain' as 'plain' | 'json',
  setOutputError: null as Error | null
}))

vi.mock('minimist', () => ({
  default: vi.fn(() => ({ _: [], output: 'plain' }))
}))

vi.mock('../../src/program.js', () => ({
  createProgram: vi.fn(() => ({
    onCommandRun: vi.fn(),
    parseAsync: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.mock('axios', () => {
  const isAxiosError = (e: any) => !!e && e.isAxiosError === true
  return { default: { isAxiosError }, isAxiosError }
})

vi.mock('../../src/core/command-runner.js', () => ({ runCommand: vi.fn() }))
vi.mock('../../src/core/interactive-runner.js', () => ({ runCommandsInteractively: vi.fn() }))

vi.mock('../../src/config.js', () => ({
  getConsoleOutputType: vi.fn(() => state.outputType),
  setConsoleOutputType: vi.fn(() => {
    if (state.setOutputError) throw state.setOutputError
  }),
  setInteractiveMode: vi.fn()
}))

vi.mock('../../src/core/commands.js', () => ({
  Commands: [{ command: 'login' }]
}))

vi.mock('chalk', () => ({
  default: {
    red: (t: string) => `red:${t}`,
    cyan: (t: string) => `cyan:${t}`
  }
}))

vi.mock('../../src/core/main-utilities.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/main-utilities.js')>()
  return { ...actual, handleMainExecutionError: vi.fn() }
})

import { AppcircleExitError } from '../../src/core/AppcircleExitError.js'
import { ProgramError } from '../../src/core/ProgramError.js'
import { handleMainExecutionError } from '../../src/core/main-utilities.js'

type MainModule = typeof import('../../src/main.js')
let mainModule: MainModule
const processHandlers: Record<string, (error: any) => void> = {}

class ExitCalled extends Error {
  constructor(public code: any) {
    super(`exit ${code}`)
  }
}

const axiosError = (status: number, statusText: string, data?: any) => ({
  isAxiosError: true,
  message: `Request failed with status code ${status}`,
  response: { status, statusText, data }
})

describe('main.ts error handling', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeAll(async () => {
    const onSpy = vi.spyOn(process, 'on').mockImplementation(((event: string, handler: any) => {
      processHandlers[event] = handler
      return process
    }) as any)
    try {
      mainModule = await import('../../src/main.js')
    } finally {
      onSpy.mockRestore()
    }
  })

  beforeEach(() => {
    state.outputType = 'plain'
    state.setOutputError = null
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: any) => {
      throw new ExitCalled(code)
    }) as any)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    errorSpy.mockClear()
  })

  afterEach(() => {
    exitSpy.mockRestore()
  })

  const runHandleError = (error: any) => {
    try {
      mainModule.handleError(error)
    } catch (e) {
      if (e instanceof ExitCalled) return e.code
      throw e
    }
    return 'no-exit'
  }

  describe('AppcircleExitError', () => {
    it('exits with 0 without output when a successful exit carries a message', () => {
      expect(runHandleError(new AppcircleExitError('All done', 0))).toBe(0)
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('exits with the code without output when a failure has no message at all', () => {
      expect(runHandleError({ name: 'AppcircleExitError', code: 2 })).toBe(2)
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('prints the error as JSON in JSON output mode', () => {
      state.outputType = 'json'
      const error = new AppcircleExitError('Build failed', 3)

      expect(runHandleError(error)).toBe(3)
      expect(errorSpy).toHaveBeenCalledWith(JSON.stringify(error))
    })
  })

  describe('JSON output mode', () => {
    beforeEach(() => {
      state.outputType = 'json'
    })

    it('explains a 403 response as missing permissions', () => {
      expect(runHandleError(axiosError(403, 'Forbidden', { code: 'X' }))).toBe(1)
      expect(JSON.parse(errorSpy.mock.calls[0][0])).toEqual({
        message: 'Request failed with status code 403',
        status: 403,
        statusText:
          'Permission Denied. You are not authorized to perform this operation. Ensure your API key has the required permissions or contact your organization administrator.',
        data: { code: 'X' }
      })
    })

    it('passes through the status text of other HTTP errors', () => {
      expect(runHandleError(axiosError(500, 'Internal Server Error'))).toBe(1)
      expect(JSON.parse(errorSpy.mock.calls[0][0])).toEqual({
        message: 'Request failed with status code 500',
        status: 500,
        statusText: 'Internal Server Error'
      })
    })

    it('prints other errors as JSON', () => {
      const error = new ProgramError('Invalid parameter')

      expect(runHandleError(error)).toBe(1)
      expect(errorSpy).toHaveBeenCalledWith(JSON.stringify(error))
    })
  })

  describe('plain output mode', () => {
    it('explains a 403 response as missing permissions', () => {
      expect(runHandleError(axiosError(403, 'Forbidden', 'denied'))).toBe(1)
      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy.mock.calls[0][0]).toBe(
        '\nred:✖ Request failed with status code 403 red:Permission Denied. You are not authorized to perform this operation. Ensure your API key has the required permissions or contact your organization administrator.denied'
      )
    })

    it('adds a login hint for a 401 response', () => {
      expect(runHandleError(axiosError(401, 'Unauthorized'))).toBe(1)
      expect(errorSpy.mock.calls[0][0]).toBe('\nred:✖ Request failed with status code 401 red:Unauthorized')
      expect(errorSpy.mock.calls[1][0]).toBe('Run cyan:"appcircle login --help" command for more information.')
    })
  })

  describe('process level handlers', () => {
    // src/main.ts registers 'unCaughtException' (wrong case). Node only emits 'uncaughtException', so in
    // production that handler never runs; this test calls it directly and pins the current key.
    it('registers an unhandledRejection handler and a misspelled unCaughtException handler that route to handleError', () => {
      expect(Object.keys(processHandlers)).toEqual(expect.arrayContaining(['unhandledRejection', 'unCaughtException']))

      expect(() => processHandlers.unhandledRejection(new ProgramError('rejected'))).toThrow(ExitCalled)
      expect(errorSpy).toHaveBeenLastCalledWith('red:✖', 'rejected')

      expect(() => processHandlers.unCaughtException(new ProgramError('thrown'))).toThrow(ExitCalled)
      expect(errorSpy).toHaveBeenLastCalledWith('red:✖', 'thrown')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('main', () => {
    it('hands an error raised while preparing the run to handleMainExecutionError', async () => {
      const failure = new Error('cannot set output type')
      state.setOutputError = failure
      vi.mocked(handleMainExecutionError).mockClear()

      await mainModule.main()

      expect(handleMainExecutionError).toHaveBeenCalledWith(failure)
    })
  })
})
