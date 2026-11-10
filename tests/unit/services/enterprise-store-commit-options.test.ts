import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/services/api', () => ({
  appcircleApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
  AUTH_HOSTNAME: 'https://auth.example.test'
}))

import { commitEnterpriseFileUpload } from '../../../src/services/enterprise-store'
import { appcircleApi } from '../../../src/services/api'

const mockApi = appcircleApi as any

describe('enterprise-store commitEnterpriseFileUpload options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends the custom tag and message for an existing profile', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { taskId: 'task-1' } })

    const result = await commitEnterpriseFileUpload({
      fileId: 7,
      fileName: 'app.ipa',
      entProfileId: 'ent-1',
      customTag: 'beta',
      message: 'release notes'
    })

    expect(result).toEqual({ taskId: 'task-1' })
    expect(mockApi.post).toHaveBeenCalledWith(
      'store/v1/profiles/app-versions?action=commitFileUpload&createNewProfile=false&profileId=ent-1',
      { fileId: 7, fileName: 'app.ipa', customTag: 'beta', message: 'release notes' },
      { headers: { Authorization: 'Bearer test-token' } }
    )
  })
})
