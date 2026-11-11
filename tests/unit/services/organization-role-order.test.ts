import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/services/api', () => ({
  appcircleApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
  AUTH_HOSTNAME: 'https://auth.example.test'
}))

import { inviteUserToOrganization } from '../../../src/services/organization'
import { appcircleApi } from '../../../src/services/api'

const mockApi = appcircleApi as any

describe('organization role ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({
      data: [
        {
          title: 'Build',
          module: 'build',
          multi: true,
          roles: [
            { key: 'build_view', name: 'View' },
            { key: 'build_edit', name: 'Edit' }
          ]
        },
        {
          title: 'Distribution',
          module: 'dist',
          roles: [
            { key: 'dist_view', name: 'View' },
            { key: 'dist_manage', name: 'Manage' }
          ]
        }
      ]
    })
    mockApi.patch.mockResolvedValue({ data: { ok: true } })
  })

  it('sorts roles of a group by index when they are given in reverse order', async () => {
    await inviteUserToOrganization({
      organizationId: 'org-1',
      email: 'user@example.test',
      role: ['build_edit', 'build_view', 'dist_manage', 'dist_view']
    })

    expect(mockApi.patch).toHaveBeenCalledWith(
      'identity/v1/users?action=invite&organizationId=org-1',
      {
        userEmail: 'user@example.test',
        organizationsAndRoles: [{ organizationId: 'org-1', roles: ['build_view', 'build_edit', 'dist_view'] }]
      },
      { headers: { Authorization: 'Bearer test-token' } }
    )
  })
})
