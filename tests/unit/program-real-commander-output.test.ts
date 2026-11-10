import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createProgram } from '../../src/program'

class ExitCalled extends Error {
  constructor(public code: any) {
    super(`exit ${code}`)
  }
}

describe('createProgram with real commander: output and default callbacks', () => {
  let argv: string[]
  let exitSpy: ReturnType<typeof vi.spyOn>
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    argv = process.argv
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: any) => {
      throw new ExitCalled(code)
    }) as any)
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((() => true) as any)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((() => true) as any)
  })

  afterEach(() => {
    process.argv = argv
    exitSpy.mockRestore()
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  const written = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((c) => String(c[0])).join('')

  it('prints the custom program help for --help and exits with 0', async () => {
    process.argv = ['node', 'appcircle', '--help']

    await expect(createProgram().parseAsync()).rejects.toMatchObject({ code: 0 })

    const out = written(stdoutSpy)
    expect(out).toContain('Appcircle CLI')
    expect(out).toContain('USAGE\n  appcircle [options] [command]')
  })

  it('routes commander errors through the custom output error handler', async () => {
    process.argv = ['node', 'appcircle', 'no-such-command']

    await expect(createProgram().parseAsync()).rejects.toMatchObject({ code: 1 })

    expect(written(stderrSpy)).toBe(
      'Incorrect Usage.\n\nUse --help to see available commands and options.\nExample: appcircle [command] [subcommand] --help\n'
    )
  })

  it('runs a command without a registered callback', async () => {
    process.argv = ['node', 'appcircle', 'build', 'profile', 'list']

    await expect(createProgram().parseAsync()).resolves.toBeDefined()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('passes the command arguments array through to the callback', async () => {
    process.argv = ['node', 'appcircle', 'build', 'profile', 'list', 'extra-arg']
    const onRun = vi.fn()
    const program = createProgram()
    program.onCommandRun(onRun)

    await program.parseAsync()

    const command = onRun.mock.calls[0][0]
    expect(command.fullCommandName).toBe('appcircle-build-profile-list')
    expect(command.args()).toEqual(['extra-arg'])
  })
})
