import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import fs from 'fs'
import axios from 'axios'

vi.mock('fs')
vi.mock('axios')

vi.mock('../../../src/services/api', () => ({
  appcircleApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
  AUTH_HOSTNAME: 'https://auth.example.test'
}))

import { downloadAppVersion, commitPublishFileUpload } from '../../../src/services/publish'
import { appcircleApi } from '../../../src/services/api'

const mockApi = appcircleApi as any

describe('publish service - download errors and commit options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects with the write error and ignores the close event that follows', async () => {
    const writer: any = new EventEmitter()
    writer.close = vi.fn()
    const data = { pipe: vi.fn() }
    vi.mocked(axios.get).mockResolvedValueOnce({ data })
    vi.mocked(fs.createWriteStream).mockReturnValue(writer)
    const writeError = new Error('disk full')

    const result = downloadAppVersion({ url: 'https://files.example.test/app.ipa', path: '/out/app.ipa' })
    await new Promise((resolve) => setImmediate(resolve))
    writer.emit('error', writeError)
    writer.emit('close')

    await expect(result).rejects.toBe(writeError)
    expect(axios.get).toHaveBeenCalledWith('https://files.example.test/app.ipa', { responseType: 'stream' })
    expect(fs.createWriteStream).toHaveBeenCalledWith('/out/app.ipa')
    expect(data.pipe).toHaveBeenCalledWith(writer)
    expect(writer.close).toHaveBeenCalled()
  })

  it('sends the custom tag and message when they are given', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { taskId: 'task-1' } })

    const result = await commitPublishFileUpload({
      platform: 'ios',
      publishProfileId: 'pp-1',
      fileId: 42,
      fileName: 'app.ipa',
      customTag: 'rc-1',
      message: 'notes'
    })

    expect(result).toEqual({ taskId: 'task-1' })
    expect(mockApi.post).toHaveBeenCalledWith(
      'publish/v1/profiles/ios/pp-1/app-versions?action=commitFileUpload',
      { fileId: 42, fileName: 'app.ipa', customTag: 'rc-1', message: 'notes' },
      { headers: { Authorization: 'Bearer test-token' } }
    )
  })
})
