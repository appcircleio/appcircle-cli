import { describe, it, expect, vi, afterEach } from 'vitest'

const interceptorUse = vi.fn()
const createdInstance = { get: vi.fn(), post: vi.fn() }

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => createdInstance),
    interceptors: { request: { use: interceptorUse } }
  }
}))

vi.mock('../../../src/config', () => ({
  readEnviromentConfigVariable: vi.fn((name: string) =>
    name === 'API_HOSTNAME' ? 'https://api.example.test/' : name === 'AUTH_HOSTNAME' ? 'https://auth.example.test' : ''
  ),
  EnvironmentVariables: {
    API_HOSTNAME: 'API_HOSTNAME',
    AUTH_HOSTNAME: 'AUTH_HOSTNAME',
    HOOK_HOSTNAME: 'HOOK_HOSTNAME',
    AC_ACCESS_TOKEN: 'AC_ACCESS_TOKEN'
  },
  getConsoleOutputType: vi.fn(() => 'plain')
}))

async function loadApi() {
  vi.resetModules()
  return await vi.importActual<typeof import('../../../src/services/api')>('../../../src/services/api')
}

describe('services/api module setup', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    interceptorUse.mockClear()
  })

  it('registers the curl logging request interceptor when CURL_LOGGING is set', async () => {
    vi.stubEnv('CURL_LOGGING', '1')

    const api = await loadApi()

    expect(interceptorUse).toHaveBeenCalledTimes(1)
    expect(typeof interceptorUse.mock.calls[0][0]).toBe('function')
    expect(api.appcircleApi).toBe(createdInstance)
    expect(api.HOOK_HOSTNAME).toBe('https://hook.appcircle.io')
  })

  it('does not register the interceptor when CURL_LOGGING is empty', async () => {
    vi.stubEnv('CURL_LOGGING', '')

    await loadApi()

    expect(interceptorUse).not.toHaveBeenCalled()
  })
})
