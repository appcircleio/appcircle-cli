import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import fs from 'fs'
import axios from 'axios'
import FormData from 'form-data'
import { getMaxUploadBytes } from '../../../src/utils/size-limit'

vi.mock('fs')
vi.mock('axios')
vi.mock('form-data')
vi.mock('../../../src/utils/size-limit')

vi.mock('../../../src/services/api', () => ({
  appcircleApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  },
  getHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
  AUTH_HOSTNAME: 'https://auth.example.test',
  HOOK_HOSTNAME: 'https://hook.example.test'
}))

import {
  DetailedMonitoringError,
  ErrorCodes,
  getHookAccessToken,
  openHookSSE,
  getTokenFromApiKey,
  downloadArtifact,
  downloadBuildLog,
  uploadArtifact,
  uploadArtifactWithSignedUrl,
  downloadTaskLog
} from '../../../src/services/index'
import { appcircleApi } from '../../../src/services/api'

const mockApi = appcircleApi as any
const mockAxios = vi.mocked(axios)
const mockFs = vi.mocked(fs)
const MockFormData = vi.mocked(FormData)

/** Writable-like event emitter used as the return value of fs.createWriteStream. */
function makeWriter() {
  const writer: any = new EventEmitter()
  writer.write = vi.fn()
  writer.end = vi.fn()
  writer.close = vi.fn()
  return writer
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

describe('services/index - retry, upload and stream edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockFormData.prototype.append = vi.fn()
    MockFormData.prototype.getHeaders = vi.fn(() => ({ 'content-type': 'multipart/form-data; boundary=b' }))
    vi.mocked(getMaxUploadBytes).mockReturnValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getHookAccessToken', () => {
    it('does not retry a 401 and reports an authentication failure', async () => {
      const error: any = new Error('Unauthorized')
      error.response = { status: 401, statusText: 'Unauthorized' }
      mockAxios.post.mockRejectedValueOnce(error)

      const result = getHookAccessToken('access-token')

      await expect(result).rejects.toMatchObject({
        name: 'DetailedMonitoringError',
        code: ErrorCodes.E_HOOK_AUTH_FAILED,
        message: 'Authentication failed with hook service. Please re-login to refresh your credentials.',
        originalError: error
      })
      expect(mockAxios.post).toHaveBeenCalledTimes(1)
      expect(mockAxios.post).toHaveBeenCalledWith('https://hook.example.test/auth/token', {}, {
        headers: { Authorization: 'Bearer access-token', 'Content-Type': 'application/json' }
      })
    })

    it('does not retry a 403 and reports access denied', async () => {
      const error: any = new Error('Forbidden')
      error.response = { status: 403, statusText: 'Forbidden' }
      mockAxios.post.mockRejectedValueOnce(error)

      await expect(getHookAccessToken('access-token')).rejects.toThrow(
        'Access denied to hook service. Please ensure you have the required permissions.'
      )
      expect(mockAxios.post).toHaveBeenCalledTimes(1)
    })

    it('retries a 5xx error three times with backoff and then reports the status', async () => {
      vi.useFakeTimers()
      const error: any = new Error('Bad Gateway')
      error.response = { status: 502, statusText: 'Bad Gateway' }
      mockAxios.post.mockRejectedValue(error)

      const result = getHookAccessToken('access-token')
      const assertion = expect(result).rejects.toThrow(
        'Hook authentication failed: 502 - Bad Gateway. Please check your network connection.'
      )
      await vi.runAllTimersAsync()
      await assertion
      expect(mockAxios.post).toHaveBeenCalledTimes(3)
    })

    it('reports a network error when the request was sent but no response came back', async () => {
      vi.useFakeTimers()
      const error: any = new Error('socket closed')
      error.request = {}
      mockAxios.post.mockRejectedValue(error)

      const result = getHookAccessToken('access-token')
      const assertion = expect(result).rejects.toThrow(
        'Hook authentication failed: Network error or timeout. Please check your network connection or proxy settings.'
      )
      await vi.runAllTimersAsync()
      await assertion
      expect(mockAxios.post).toHaveBeenCalledTimes(3)
    })

    it('reports a timeout when the hook service never answers', async () => {
      vi.useFakeTimers()
      mockAxios.post.mockImplementation(() => new Promise(() => {}))

      const result = getHookAccessToken('access-token')
      const assertion = expect(result).rejects.toMatchObject({
        code: ErrorCodes.E_HOOK_AUTH_FAILED,
        message: 'Hook authentication failed: Network error or timeout. Please check your network connection or proxy settings.',
        originalError: expect.objectContaining({ message: 'Request timeout' })
      })
      await vi.runAllTimersAsync()
      await assertion
      expect(mockAxios.post).toHaveBeenCalledTimes(3)
    })

    it('falls back to a generic error when every attempt rejects without an error object', async () => {
      vi.useFakeTimers()
      mockAxios.post.mockRejectedValue(0)

      const result = getHookAccessToken('access-token')
      const assertion = expect(result).rejects.toThrow('Hook authentication failed: Max retries exceeded')
      await vi.runAllTimersAsync()
      await assertion
      expect(mockAxios.post).toHaveBeenCalledTimes(3)
    })

    it('rejects an empty access token from the hook service without wrapping it', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { access_token: '   ', expires_in: 60 } })

      const result = getHookAccessToken('access-token')

      await expect(result).rejects.toBeInstanceOf(DetailedMonitoringError)
      await expect(result).rejects.toMatchObject({
        code: ErrorCodes.E_HOOK_AUTH_FAILED,
        message: 'Invalid or empty access token received from hook service. Please re-login and try again.',
        originalError: undefined
      })
    })
  })

  describe('openHookSSE', () => {
    const params = {
      hookHostname: 'https://hook.example.test',
      userId: 'user-1',
      organizationId: 'org-1',
      token: 'hook-token'
    }

    function makeStream() {
      const stream: any = new EventEmitter()
      stream.destroy = vi.fn()
      return stream
    }

    it('ignores id lines and blank lines that do not close an event', async () => {
      const stream = makeStream()
      mockAxios.mockResolvedValueOnce({ status: 200, data: stream } as any)
      const connection = await openHookSSE(params)
      const onMessage = vi.fn()
      connection.onMessage(onMessage)

      stream.emit('data', Buffer.from('\nid: 7\nretry: 100\nevent: build-log\ndata: hello\n\n'))

      expect(onMessage).toHaveBeenCalledTimes(1)
      expect(onMessage).toHaveBeenCalledWith(' hello')
    })

    it('logs and swallows an error thrown by an error callback', async () => {
      const stream = makeStream()
      mockAxios.mockResolvedValueOnce({ status: 200, data: stream } as any)
      const connection = await openHookSSE(params)
      const callbackError = new Error('callback broke')
      const second = vi.fn()
      connection.onError(() => {
        throw callbackError
      })
      connection.onError(second)
      const streamError = new Error('stream broke')

      stream.emit('error', streamError)

      expect(console.error).toHaveBeenCalledWith('Error in SSE error callback:', callbackError)
      expect(second).toHaveBeenCalledWith(streamError)
    })

    it('stops forwarding errors and end events after the connection is closed', async () => {
      const stream = makeStream()
      mockAxios.mockResolvedValueOnce({ status: 200, data: stream } as any)
      const connection = await openHookSSE(params)
      const onError = vi.fn()
      const onClose = vi.fn()
      connection.onError(onError)
      connection.onClose(onClose)

      connection.close()
      connection.close()
      stream.emit('error', new Error('late'))
      stream.emit('end')
      stream.emit('close')

      expect(stream.destroy).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onError).not.toHaveBeenCalled()
    })

    it('swallows errors thrown by close callbacks on stream end and on close()', async () => {
      const stream = makeStream()
      mockAxios.mockResolvedValueOnce({ status: 200, data: stream } as any)
      const connection = await openHookSSE(params)
      const throwing = vi.fn(() => {
        throw new Error('close callback broke')
      })
      connection.onClose(throwing)

      expect(() => stream.emit('end')).not.toThrow()
      expect(throwing).toHaveBeenCalledTimes(1)

      const stream2 = makeStream()
      mockAxios.mockResolvedValueOnce({ status: 200, data: stream2 } as any)
      const connection2 = await openHookSSE(params)
      connection2.onClose(throwing)
      expect(() => connection2.close()).not.toThrow()
      expect(throwing).toHaveBeenCalledTimes(2)
    })

    it('reports four failed attempts without an original error when the request rejects with a falsy value', async () => {
      vi.useFakeTimers()
      mockAxios.mockRejectedValue(0 as any)

      const result = openHookSSE(params)
      const assertion = expect(result).rejects.toMatchObject({
        code: ErrorCodes.E_SSE_CONNECT_FAILED,
        message: 'Failed to establish SSE connection after 4 attempts. Please check your network connection and hook service availability.',
        originalError: undefined
      })
      await vi.runAllTimersAsync()
      await assertion
      expect(mockAxios).toHaveBeenCalledTimes(4)
    })
  })

  describe('getTokenFromApiKey', () => {
    it('rejects a missing API key secret before calling the auth service', async () => {
      await expect(getTokenFromApiKey({ name: 'ci-key', secret: '  ' })).rejects.toThrow(
        'API key secret is required and must be non-empty'
      )
      expect(mockAxios.post).not.toHaveBeenCalled()
    })
  })

  describe('downloadArtifact', () => {
    it('rejects an empty download path before calling the API', async () => {
      await expect(downloadArtifact({ buildId: 'build-1', commitId: 'commit-1' }, '  ')).rejects.toThrow(
        'Download path is required'
      )
      expect(mockApi.get).not.toHaveBeenCalled()
    })
  })

  describe('downloadBuildLog', () => {
    it('uses the first build of the commit when no build ID is given', async () => {
      mockApi.get.mockImplementation(async (url: string) => {
        if (url === 'build/v2/commits/commit-1') {
          return { data: { builds: [{ id: 'build-from-commit' }] } }
        }
        return { data: 'log line' }
      })
      const writer = makeWriter()
      mockFs.createWriteStream.mockReturnValue(writer)

      const result = downloadBuildLog({ commitId: 'commit-1' }, '/logs')
      await flush()
      writer.emit('finish')

      await expect(result).resolves.toBe(true)
      expect(mockApi.get).toHaveBeenCalledWith(
        'build/v1/commits/commit-1/builds/build-from-commit/logs',
        expect.objectContaining({ responseType: 'text' })
      )
      expect(mockFs.createWriteStream).toHaveBeenCalledWith('/logs/build-from-commit-log.txt')
      expect(writer.write).toHaveBeenCalledWith('log line')
    })

    it('continues with the given build ID when the commit lookup fails', async () => {
      const zeroId = '00000000-0000-0000-0000-000000000000'
      mockApi.get.mockImplementation(async (url: string) => {
        if (url === 'build/v2/commits/commit-1') {
          throw new Error('lookup failed')
        }
        return { data: 'log line' }
      })
      const writer = makeWriter()
      mockFs.createWriteStream.mockReturnValue(writer)

      const result = downloadBuildLog({ commitId: 'commit-1', buildId: zeroId }, '/logs', 'custom.txt')
      await flush()
      writer.emit('finish')

      await expect(result).resolves.toBe(true)
      expect(console.log).toHaveBeenCalledWith(
        `API error: lookup failed. Continuing with existing build ID: ${zeroId}`
      )
      expect(mockApi.get).toHaveBeenCalledWith(
        `build/v1/commits/commit-1/builds/${zeroId}/logs`,
        expect.anything()
      )
      expect(mockFs.createWriteStream).toHaveBeenCalledWith('/logs/custom.txt')
    })
  })

  describe('uploadArtifact', () => {
    it('rejects a path that is not a file', async () => {
      mockFs.statSync.mockReturnValue({ isFile: () => false } as any)

      await expect(
        uploadArtifact({ message: 'm', app: '/tmp/dir', distProfileId: 'p1' })
      ).rejects.toThrow('Provided path is not a file')
      expect(mockApi.post).not.toHaveBeenCalled()
    })
  })

  describe('uploadArtifactWithSignedUrl', () => {
    const uploadInfo = { uploadUrl: 'https://bucket.example.test/put', fileId: 'f1', configuration: null as any }
    const stream = { path: '/app/test.ipa' }

    beforeEach(() => {
      mockFs.statSync.mockReturnValue({ size: 2048 } as any)
      mockFs.createReadStream.mockReturnValue(stream as any)
      vi.spyOn(Math, 'random').mockReturnValue(0)
    })

    it('sends the file untouched through an identity transformRequest', async () => {
      mockAxios.put.mockResolvedValueOnce({ status: 200 })

      await uploadArtifactWithSignedUrl({ app: '/app/test.ipa', uploadInfo })

      const config = mockAxios.put.mock.calls[0][2] as any
      expect(config.responseType).toBe('arraybuffer')
      const body = { any: 'body' }
      expect(config.transformRequest[0](body)).toBe(body)
    })

    it('retries 503, ECONNRESET and socket hang up errors with doubling delays', async () => {
      vi.useFakeTimers()
      const unavailable: any = new Error('Service Unavailable')
      unavailable.response = { status: 503 }
      const reset: any = new Error('reset')
      reset.code = 'ECONNRESET'
      const hangUp = new Error('socket hang up')
      mockAxios.put
        .mockRejectedValueOnce(unavailable)
        .mockRejectedValueOnce(reset)
        .mockRejectedValueOnce(hangUp)
        .mockResolvedValueOnce({ status: 200, data: 'ok' })
      const timeoutSpy = vi.spyOn(global, 'setTimeout')

      const result = uploadArtifactWithSignedUrl({ app: '/app/test.ipa', uploadInfo })
      await vi.runAllTimersAsync()

      await expect(result).resolves.toEqual({ status: 200, data: 'ok' })
      expect(mockAxios.put).toHaveBeenCalledTimes(4)
      const delays = timeoutSpy.mock.calls.map((call) => call[1])
      expect(delays).toEqual([1000, 2000, 4000])
    })

    it('does not retry a non-retryable error', async () => {
      const forbidden: any = new Error('Forbidden')
      forbidden.response = { status: 403 }
      mockAxios.put.mockRejectedValueOnce(forbidden)

      await expect(uploadArtifactWithSignedUrl({ app: '/app/test.ipa', uploadInfo })).rejects.toBe(forbidden)
      expect(mockAxios.put).toHaveBeenCalledTimes(1)
    })

    it('does not retry an error object without message or response', async () => {
      mockAxios.put.mockRejectedValueOnce({})

      await expect(uploadArtifactWithSignedUrl({ app: '/app/test.ipa', uploadInfo })).rejects.toEqual({})
      expect(mockAxios.put).toHaveBeenCalledTimes(1)
    })

    it('gives up after five retries', async () => {
      vi.useFakeTimers()
      const unavailable: any = new Error('Service Unavailable')
      unavailable.response = { status: 503 }
      mockAxios.put.mockRejectedValue(unavailable)

      const result = uploadArtifactWithSignedUrl({ app: '/app/test.ipa', uploadInfo })
      const assertion = expect(result).rejects.toBe(unavailable)
      await vi.runAllTimersAsync()
      await assertion
      expect(mockAxios.put).toHaveBeenCalledTimes(6)
    })

    it('posts only the file when the POST configuration has no sign parameters', async () => {
      mockAxios.post.mockResolvedValueOnce({ status: 204 })

      await uploadArtifactWithSignedUrl({
        app: '/app/test.ipa',
        uploadInfo: { uploadUrl: 'https://bucket.example.test/post', fileId: 'f2', configuration: { httpMethod: 'POST' } as any }
      })

      expect(MockFormData.prototype.append).toHaveBeenCalledTimes(1)
      expect(MockFormData.prototype.append).toHaveBeenCalledWith('file', stream)
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://bucket.example.test/post',
        expect.any(MockFormData),
        expect.objectContaining({ headers: { 'content-type': 'multipart/form-data; boundary=b' } })
      )
    })
  })

  describe('downloadTaskLog', () => {
    it('turns a non-200 response into an HTTP error', async () => {
      mockApi.get.mockResolvedValueOnce({ status: 204, headers: {}, data: null })

      await expect(downloadTaskLog({ taskId: 't1' }, '/logs')).rejects.toThrow('HTTP error: 204')
    })

    it('rejects when writing a text log fails', async () => {
      const data: any = new EventEmitter()
      mockApi.get.mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'text/plain' }, data })
      const writer = makeWriter()
      mockFs.createWriteStream.mockReturnValue(writer)
      const writeError = new Error('disk full')

      const result = downloadTaskLog({ taskId: 't1' }, '/logs', 'task.txt')
      await flush()
      data.emit('data', Buffer.from('line 1'))
      data.emit('end')
      writer.emit('error', writeError)

      await expect(result).rejects.toBe(writeError)
      expect(mockFs.createWriteStream).toHaveBeenCalledWith('/logs/task.txt')
      expect(writer.write).toHaveBeenCalledWith('line 1')
    })

    it('rejects when the text log stream itself fails', async () => {
      const data: any = new EventEmitter()
      mockApi.get.mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'application/json' }, data })
      const streamError = new Error('connection reset')

      const result = downloadTaskLog({ taskId: 't1' }, '/logs')
      await flush()
      data.emit('error', streamError)

      await expect(result).rejects.toBe(streamError)
      expect(mockFs.createWriteStream).not.toHaveBeenCalled()
    })

    it('ignores the close event after a binary write error', async () => {
      const data: any = { pipe: vi.fn() }
      mockApi.get.mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'application/octet-stream' }, data })
      const writer = makeWriter()
      mockFs.createWriteStream.mockReturnValue(writer)
      const writeError = new Error('write failed')

      const result = downloadTaskLog({ taskId: 't9' }, '/logs')
      await flush()
      writer.emit('error', writeError)
      writer.emit('close')

      await expect(result).rejects.toBe(writeError)
      expect(writer.close).toHaveBeenCalled()
      expect(data.pipe).toHaveBeenCalledWith(writer)
      expect(mockFs.createWriteStream).toHaveBeenCalledWith('/logs/build-task-t9-log.txt')
    })
  })
})
