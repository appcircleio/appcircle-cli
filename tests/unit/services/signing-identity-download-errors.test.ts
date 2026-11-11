import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import fs from 'fs'
import FormData from 'form-data'

vi.mock('fs')
vi.mock('form-data')

vi.mock('../../../src/services/api', () => ({
  appcircleApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
  AUTH_HOSTNAME: 'https://auth.example.test'
}))

import {
  downloadKeystoreById,
  downloadCertificateById,
  downloadProvisioningProfileById
} from '../../../src/services/signing-identity'
import { appcircleApi } from '../../../src/services/api'

const mockApi = appcircleApi as any

function setupFailingWriter() {
  const writer: any = new EventEmitter()
  writer.close = vi.fn()
  const data = { pipe: vi.fn() }
  mockApi.get.mockResolvedValueOnce({ data })
  vi.mocked(fs.createWriteStream).mockReturnValue(writer)
  return { writer, data }
}

async function failAfterStart(writer: any, error: Error) {
  await new Promise((resolve) => setImmediate(resolve))
  writer.emit('error', error)
  writer.emit('close')
}

describe('signing-identity downloads - write errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(FormData).prototype.append = vi.fn()
    vi.mocked(FormData).prototype.getHeaders = vi.fn(() => ({ 'content-type': 'multipart/form-data' }))
  })

  it('downloadKeystoreById rejects with the write error and ignores the later close', async () => {
    const { writer, data } = setupFailingWriter()
    const error = new Error('keystore write failed')

    const result = downloadKeystoreById({ keystoreId: 'ks-1', path: '/out' }, '/out', 'ks.jks')
    await failAfterStart(writer, error)

    await expect(result).rejects.toBe(error)
    expect(fs.createWriteStream).toHaveBeenCalledWith('/out/ks.jks')
    expect(data.pipe).toHaveBeenCalledWith(writer)
    expect(writer.close).toHaveBeenCalled()
  })

  it('downloadCertificateById rejects with the write error and ignores the later close', async () => {
    const { writer } = setupFailingWriter()
    const error = new Error('certificate write failed')

    const result = downloadCertificateById({ certificateId: 'c-1', path: '/out' }, '/out', 'c.csr', 'csr')
    await failAfterStart(writer, error)

    await expect(result).rejects.toBe(error)
    expect(mockApi.get.mock.calls[0][0]).toMatch(/\/v1\/csr\/c-1$/)
    expect(fs.createWriteStream).toHaveBeenCalledWith('/out/c.csr')
    expect(writer.close).toHaveBeenCalled()
  })

  it('downloadProvisioningProfileById rejects with the write error and ignores the later close', async () => {
    const { writer } = setupFailingWriter()
    const error = new Error('profile write failed')

    const result = downloadProvisioningProfileById({ provisioningProfileId: 'pp-1' }, '/out', 'p.mobileprovision')
    await failAfterStart(writer, error)

    await expect(result).rejects.toBe(error)
    expect(fs.createWriteStream).toHaveBeenCalledWith('/out/p.mobileprovision')
    expect(writer.close).toHaveBeenCalled()
  })
})
