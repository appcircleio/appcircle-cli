import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'

export interface CliResult {
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * Helper to run CLI commands and capture output
 * Uses child_process to test the actual CLI binary
 */
export function runCli(args: string[] = [], options: { timeout?: number } = {}): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const cliPath = path.resolve(__dirname, '../../bin/appcircle.js')
    const child: ChildProcess = spawn('node', [cliPath, ...args], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' }
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    const timeoutMs = options.timeout || 10000
    const timeoutId = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`CLI command timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    child.on('close', (code: number | null) => {
      clearTimeout(timeoutId)
      resolve({
        exitCode: code || 0,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      })
    })

    child.on('error', (error: Error) => {
      clearTimeout(timeoutId)
      reject(error)
    })
  })
}