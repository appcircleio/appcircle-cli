import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'

vi.mock('../../../src/services/api', () => ({
  appcircleApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  },
  getHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
  AUTH_HOSTNAME: 'https://auth.example.test'
}))

import {
  getLatestAppVersionIdAfterUpload,
  getAppVersionAfterUploadWithTaskCompletion,
  commitTestingDistributionFileUpload
} from '../../../src/services/testing-distribution'
import { appcircleApi } from '../../../src/services/api'

const realPath = await vi.importActual<typeof import('path')>('path')
const mockApi = appcircleApi as any

const T0 = new Date('2026-01-01T00:00:00.000Z').getTime()

/** createdAt for a version that is `ageMs` old at the moment the lookup runs (after the initial wait). */
const createdAgo = (ageMs: number, waitMs = 3000) => new Date(T0 + waitMs - ageMs).toISOString()

function mockProfile(appVersions: any[]) {
  mockApi.get.mockResolvedValue({ data: { id: 'profile-1', appVersions } })
}

async function runLatestAfterUpload(options: Parameters<typeof getLatestAppVersionIdAfterUpload>[0]) {
  const result = getLatestAppVersionIdAfterUpload(options)
  await vi.advanceTimersByTimeAsync(options.isAab ? 8000 : 3000)
  return result
}

describe('testing-distribution version matching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    vi.mocked(path.parse).mockImplementation(realPath.parse)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getLatestAppVersionIdAfterUpload', () => {
    it('prefers a partial file name match over a recent version with another name', async () => {
      mockProfile([
        { id: 'other', fileName: 'other.apk', createdAt: createdAgo(1000) },
        { id: 'partial', fileName: 'my-app.ipa', createdAt: createdAgo(1000) }
      ])

      await expect(runLatestAfterUpload({ distProfileId: 'profile-1', fileName: 'app.ipa' })).resolves.toBe('partial')
      expect(mockApi.get).toHaveBeenCalledWith('distribution/v2/profiles/profile-1', expect.anything())
    })

    it('matches an AAB upload by its exact base name', async () => {
      mockProfile([
        { id: 'unrelated', fileName: 'zzz.apk', createdAt: createdAgo(1000, 8000) },
        { id: 'base-exact', fileName: 'release.apk', createdAt: createdAgo(1000, 8000) }
      ])

      await expect(
        runLatestAfterUpload({ distProfileId: 'profile-1', fileName: 'release.aab', isAab: true })
      ).resolves.toBe('base-exact')
    })

    it('matches an AAB upload when the version base name contains the uploaded base name', async () => {
      mockProfile([
        { id: 'unrelated', fileName: 'zzz.apk', createdAt: createdAgo(1000, 8000) },
        { id: 'base-partial', fileName: 'release-signed.apk', createdAt: createdAgo(1000, 8000) }
      ])

      await expect(
        runLatestAfterUpload({ distProfileId: 'profile-1', fileName: 'release.aab', isAab: true })
      ).resolves.toBe('base-partial')
    })

    it('matches an AAB upload when the uploaded base name contains the version base name', async () => {
      mockProfile([
        { id: 'unrelated', fileName: 'zzz.apk', createdAt: createdAgo(1000, 8000) },
        { id: 'base-contained', fileName: 'rel.apk', createdAt: createdAgo(1000, 8000) }
      ])

      await expect(
        runLatestAfterUpload({ distProfileId: 'profile-1', fileName: 'release.aab', isAab: true })
      ).resolves.toBe('base-contained')
    })

    it('breaks a score tie by picking the newer version', async () => {
      mockProfile([
        { id: 'older', fileName: 'app.ipa', createdAt: createdAgo(1100) },
        { id: 'newer', fileName: 'app.ipa', createdAt: createdAgo(1000) }
      ])

      await expect(runLatestAfterUpload({ distProfileId: 'profile-1', fileName: 'app.ipa' })).resolves.toBe('newer')
    })

    it('still accepts a size-only lookup when the size does not match', async () => {
      mockProfile([{ id: 'size-off', size: 10_000, createdAt: createdAgo(1000) }])

      await expect(
        runLatestAfterUpload({ distProfileId: 'profile-1', expectedFileSize: 1_000 })
      ).resolves.toBe('size-off')
    })

    it('falls back to the newest recent version when size and name are required but the size is unknown', async () => {
      mockProfile([{ id: 'no-size', fileName: 'app.ipa', createdAt: createdAgo(1000) }])

      await expect(
        runLatestAfterUpload({ distProfileId: 'profile-1', expectedFileSize: 1_000, fileName: 'app.ipa' })
      ).resolves.toBe('no-size')
    })

    it('falls back to the newest recent version when size and name are required but the name is unknown', async () => {
      mockProfile([{ id: 'no-name', size: 1_000, createdAt: createdAgo(1000) }])

      await expect(
        runLatestAfterUpload({ distProfileId: 'profile-1', expectedFileSize: 1_000, fileName: 'app.ipa' })
      ).resolves.toBe('no-name')
    })

    it('returns the newest version when no matching criteria are given and it is recent', async () => {
      mockProfile([
        { id: 'old', createdAt: createdAgo(10_000) },
        { id: 'recent', createdAt: createdAgo(2_000) }
      ])

      await expect(runLatestAfterUpload({ distProfileId: 'profile-1' })).resolves.toBe('recent')
    })

    it('returns null when the newest version is older than the window', async () => {
      mockProfile([{ id: 'stale', createdAt: createdAgo(60_000) }])

      await expect(runLatestAfterUpload({ distProfileId: 'profile-1' })).resolves.toBeNull()
    })
  })

  describe('getAppVersionAfterUploadWithTaskCompletion', () => {
    const uploadStartTime = T0 - 5_000

    it('ignores versions without createdAt and matches when size or name is unknown', async () => {
      mockApi.get.mockResolvedValue({
        data: {
          appVersions: [
            { id: 'no-date', fileName: 'app.ipa', size: 100 },
            { id: 'unknown-size-and-name', createdAt: new Date(T0).toISOString() }
          ]
        }
      })
      const waitForTaskCompletion = vi.fn().mockResolvedValue(undefined)

      const result = await getAppVersionAfterUploadWithTaskCompletion({
        distProfileId: 'profile-1',
        taskId: 'task-1',
        uploadStartTime,
        expectedFileSize: 100,
        fileName: 'app.ipa',
        waitForTaskCompletion
      })

      expect(result).toBe('unknown-size-and-name')
      expect(waitForTaskCompletion).toHaveBeenCalledWith('task-1')
      expect(mockApi.get).toHaveBeenCalledTimes(1)
    })

    it('returns the newest version uploaded after the start when none matches the size', async () => {
      mockApi.get.mockResolvedValue({
        data: {
          appVersions: [
            { id: 'first', size: 50_000, createdAt: new Date(T0 - 1_000).toISOString() },
            { id: 'second', size: 60_000, createdAt: new Date(T0).toISOString() },
            { id: 'before-upload', size: 100, createdAt: new Date(T0 - 60_000).toISOString() }
          ]
        }
      })

      const result = await getAppVersionAfterUploadWithTaskCompletion({
        distProfileId: 'profile-1',
        taskId: 'task-1',
        uploadStartTime,
        expectedFileSize: 100,
        waitForTaskCompletion: vi.fn().mockResolvedValue(undefined)
      })

      expect(result).toBe('second')
    })
  })

  describe('commitTestingDistributionFileUpload', () => {
    it('sends the custom tag and message when they are given', async () => {
      mockApi.post.mockResolvedValue({ data: { taskId: 'task-9' } })

      const result = await commitTestingDistributionFileUpload({
        distProfileId: 'profile-1',
        fileId: 'file-1',
        fileName: 'app.ipa',
        customTag: 'v1.2',
        message: 'Release notes'
      })

      expect(result).toEqual({ taskId: 'task-9' })
      expect(mockApi.post).toHaveBeenCalledWith(
        'distribution/v1/profiles/profile-1/app-versions?action=commitFileUpload',
        { fileId: 'file-1', fileName: 'app.ipa', customTag: 'v1.2', message: 'Release notes' },
        { headers: { Authorization: 'Bearer test-token' } }
      )
    })
  })
})
