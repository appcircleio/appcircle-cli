import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AxiosError } from 'axios'

vi.mock('../../../src/config', () => ({
  getConsoleOutputType: vi.fn(() => 'plain')
}))

import { handleMainExecutionError } from '../../../src/core/main-utilities'

describe('handleMainExecutionError with an axios error in plain mode', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    errorSpy.mockClear()
  })

  afterEach(() => {
    exitSpy.mockRestore()
  })

  it('prints the axios message with its code and exits with 1', () => {
    handleMainExecutionError(new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED'))

    expect(errorSpy).toHaveBeenCalledWith('connect ECONNREFUSED ECONNREFUSED')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
