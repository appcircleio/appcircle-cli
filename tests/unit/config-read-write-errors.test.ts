import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = vi.hoisted(() => ({ failEnvAccess: false }))

vi.mock('conf', () => ({
  default: vi.fn(function () {
    return {
      store: { current: 'default', envs: {} },
      path: '/mock/config.json',
      get: vi.fn((key: string) => {
        if (key === 'current') return 'staging'
        if (store.failEnvAccess) throw new Error('config file is corrupt')
        return 'value'
      }),
      set: vi.fn(() => {
        if (store.failEnvAccess) throw new Error('read-only file system')
      }),
      clear: vi.fn()
    }
  })
}))

import { readEnviromentConfigVariable, writeEnviromentConfigVariable, EnvironmentVariables } from '../../src/config'

describe('config read/write errors', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    store.failEnvAccess = false
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    errorSpy.mockClear()
  })

  it('reads a variable of the current environment', () => {
    expect(readEnviromentConfigVariable(EnvironmentVariables.API_HOSTNAME)).toBe('value')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('returns an empty string and reports when the config cannot be read', () => {
    store.failEnvAccess = true

    expect(readEnviromentConfigVariable(EnvironmentVariables.API_HOSTNAME)).toBe('')
    expect(errorSpy).toHaveBeenCalledWith('Could not read data, returning empty.')
  })

  it('reports when the config cannot be written', () => {
    store.failEnvAccess = true

    expect(() => writeEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN, 'token')).not.toThrow()
    expect(errorSpy).toHaveBeenCalledWith('Could not write variable to the config file.')
  })
})
