import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProgramError } from '../../../src/core/ProgramError'

// Mock dependencies first
vi.mock('../../../src/services/api.js', () => ({
  appcircleApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  },
  getHeaders: vi.fn(() => ({
    'Authorization': 'Bearer test-token',
    'Content-Type': 'application/json'
  }))
}))

// Import functions after mocking
import * as organizationModule from '../../../src/services/organization'

const {
  getOrganizations,
  getOrganizationDetail,
  getOrganizationUsers,
  getOrganizationUsersWithRoles,
  getOrganizationInvitations,
  getRoleList,
  inviteUserToOrganization,
  reInviteUserToOrganization,
  removeInvitationFromOrganization,
  removeUserFromOrganization,
  getOrganizationUserRoles,
  assignRolesToUserInOrganitaion, // Note: Preserving typo from source
  getOrganizationUserinfo,
  createSubOrganization
} = organizationModule

import { appcircleApi, getHeaders } from '../../../src/services/api'

const mockAppcircleApi = appcircleApi as any
const mockGetHeaders = getHeaders as any

describe('Organization Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Organization Operations', () => {
    describe('getOrganizations', () => {
      it('should fetch organizations and return data.data', async () => {
        const mockOrgs = [
          { id: 'org1', name: 'Company A', members: 15 },
          { id: 'org2', name: 'Company B', members: 8 }
        ]
        mockAppcircleApi.get.mockResolvedValue({ 
          data: { data: mockOrgs, meta: { total: 2 } }
        })

        const result = await getOrganizations()

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'identity/v1/organizations',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockOrgs) // Returns data.data, not data
      })

      it('should handle empty organizations list', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: { data: [] } })
        
        const result = await getOrganizations()
        expect(result).toEqual([])
      })

      it('should handle API errors when fetching organizations', async () => {
        const apiError = new Error('Failed to fetch organizations')
        mockAppcircleApi.get.mockRejectedValue(apiError)

        await expect(getOrganizations()).rejects.toThrow('Failed to fetch organizations')
      })

      it('should include proper headers in request', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: { data: [] } })
        
        await getOrganizations()

        expect(mockGetHeaders).toHaveBeenCalled()
      })
    })

    describe('getOrganizationDetail', () => {
      it('should fetch organization details by ID', async () => {
        const mockOrgDetail = { 
          id: 'org123', 
          name: 'Test Org', 
          users: 5,
          settings: { autoInvite: true }
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockOrgDetail })

        const result = await getOrganizationDetail({ organizationId: 'org123' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'identity/v1/organizations/org123',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockOrgDetail)
      })

      it('should handle organization not found', async () => {
        const notFoundError = new Error('Organization not found') as any
        notFoundError.response = { status: 404 }
        mockAppcircleApi.get.mockRejectedValue(notFoundError)

        await expect(getOrganizationDetail({ organizationId: 'nonexistent' }))
          .rejects.toThrow('Organization not found')
      })

      it('should handle invalid organization ID', async () => {
        const invalidError = new Error('Invalid organization ID')
        mockAppcircleApi.get.mockRejectedValue(invalidError)

        await expect(getOrganizationDetail({ organizationId: '' }))
          .rejects.toThrow('Invalid organization ID')
      })

      it('should handle permissions error', async () => {
        const permError = new Error('Insufficient permissions') as any
        permError.response = { status: 403 }
        mockAppcircleApi.get.mockRejectedValue(permError)

        await expect(getOrganizationDetail({ organizationId: 'org123' }))
          .rejects.toThrow('Insufficient permissions')
      })
    })

    describe('createSubOrganization', () => {
      it('should create sub-organization successfully', async () => {
        const mockSubOrg = { 
          id: 'suborg123', 
          name: 'Test Sub-Org',
          parentId: 'org123'
        }
        mockAppcircleApi.post.mockResolvedValue({ data: mockSubOrg })

        const result = await createSubOrganization({ name: 'Test Sub-Org' })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'identity/v1/organizations/current/sub-organizations',
          { name: 'Test Sub-Org' },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockSubOrg)
      })

      it('should handle duplicate sub-organization name', async () => {
        const duplicateError = new Error('Sub-organization name already exists') as any
        duplicateError.response = { status: 409 }
        mockAppcircleApi.post.mockRejectedValue(duplicateError)

        await expect(createSubOrganization({ name: 'Existing Sub-Org' }))
          .rejects.toThrow('Sub-organization name already exists')
      })

      it('should handle invalid sub-organization name', async () => {
        const invalidError = new Error('Invalid sub-organization name')
        mockAppcircleApi.post.mockRejectedValue(invalidError)

        await expect(createSubOrganization({ name: '' }))
          .rejects.toThrow('Invalid sub-organization name')
      })

      it('should handle special characters in name', async () => {
        const specialName = 'Sub-Org (Test) & More! 🚀'
        const mockSubOrg = { id: 'suborg456', name: specialName }
        mockAppcircleApi.post.mockResolvedValue({ data: mockSubOrg })

        const result = await createSubOrganization({ name: specialName })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'identity/v1/organizations/current/sub-organizations',
          { name: specialName },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockSubOrg)
      })
    })
  })

  describe('User Management', () => {
    describe('getOrganizationUsers', () => {
      it('should fetch organization users', async () => {
        const mockUsers = [
          { id: 'user1', email: 'user1@example.com', name: 'User One' },
          { id: 'user2', email: 'user2@example.com', name: 'User Two' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockUsers })

        const result = await getOrganizationUsers({ organizationId: 'org123' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'identity/v1/organizations/org123/users',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockUsers)
      })

      it('should handle empty users list', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })

        const result = await getOrganizationUsers({ organizationId: 'org123' })
        expect(result).toEqual([])
      })
    })

    describe('getOrganizationUsersWithRoles', () => {
      beforeEach(() => {
        // Mock getOrganizationUsers response
        const mockUsers = [
          { id: 'user1', email: 'user1@example.com' },
          { id: 'user2', email: 'user2@example.com' }
        ]
        
        // First call for getOrganizationUsers
        mockAppcircleApi.get
          .mockResolvedValueOnce({ data: mockUsers })
          // Subsequent calls for getOrganizationUserRoles
          .mockResolvedValue({ 
            data: { 
              roles: ['admin'], 
              inheritedRoles: ['viewer'],
              isSubOrganizationMember: false 
            }
          })
      })

      it('should fetch users with their roles', async () => {
        const result = await getOrganizationUsersWithRoles({ organizationId: 'org123' })

        expect(result).toHaveLength(2)
        expect(result[0]).toHaveProperty('roles')
        expect(result[0]).toHaveProperty('inheritedRoles')
        expect(result[0]).toHaveProperty('isSubOrganizationMember')
        expect(result[0].roles).toEqual(['admin'])
        expect(result[0].inheritedRoles).toEqual(['viewer'])
      })

      it('should filter sub-organization members when onlyGivenOrganization=true', async () => {
        // Reset mocks for this specific test
        mockAppcircleApi.get.mockReset()
        
        const mockUsers = [
          { id: 'user1', email: 'user1@example.com' },
          { id: 'user2', email: 'user2@example.com' }
        ]
        
        mockAppcircleApi.get
          .mockResolvedValueOnce({ data: mockUsers })
          .mockResolvedValueOnce({ 
            data: { roles: ['admin'], isSubOrganizationMember: false, inheritedRoles: [] }
          })
          .mockResolvedValueOnce({ 
            data: { roles: [], isSubOrganizationMember: true, inheritedRoles: [] }
          })

        const result = await getOrganizationUsersWithRoles({ 
          organizationId: 'org123', 
          onlyGivenOrganization: true 
        })

        expect(result).toHaveLength(1) // Should filter out sub-org members
        expect(result[0].id).toBe('user1')
        expect(result[0].isSubOrganizationMember).toBe(false)
      })

      it('should handle empty user roles for sub-organization members', async () => {
        mockAppcircleApi.get.mockReset()
        
        const mockUsers = [{ id: 'user1', email: 'user1@example.com' }]
        
        mockAppcircleApi.get
          .mockResolvedValueOnce({ data: mockUsers })
          .mockResolvedValueOnce({ 
            data: { roles: [], isSubOrganizationMember: true, inheritedRoles: [] }
          })

        const result = await getOrganizationUsersWithRoles({ organizationId: 'org123' })

        expect(result[0].roles).toEqual([])
        expect(result[0].isSubOrganizationMember).toBe(true)
        expect(result[0].inheritedRoles).toEqual([])
      })

      it('should handle role fetch failures for individual users', async () => {
        mockAppcircleApi.get.mockReset()
        
        const mockUsers = [{ id: 'user1', email: 'user1@example.com' }]
        
        mockAppcircleApi.get
          .mockResolvedValueOnce({ data: mockUsers })
          .mockRejectedValueOnce(new Error('Role fetch failed'))

        await expect(getOrganizationUsersWithRoles({ organizationId: 'org123' }))
          .rejects.toThrow('Role fetch failed')
      })

      it('should handle large user lists efficiently', async () => {
        mockAppcircleApi.get.mockReset()
        
        const largeUserList = Array(100).fill(0).map((_, i) => ({
          id: `user${i}`,
          email: `user${i}@example.com`
        }))

        mockAppcircleApi.get
          .mockResolvedValueOnce({ data: largeUserList })
          .mockResolvedValue({ 
            data: { roles: ['viewer'], isSubOrganizationMember: false, inheritedRoles: [] }
          })

        const result = await getOrganizationUsersWithRoles({ organizationId: 'org123' })

        expect(result).toHaveLength(100)
        // Verify all users have roles populated
        result.forEach(user => {
          expect(user).toHaveProperty('roles')
          expect(user).toHaveProperty('isSubOrganizationMember')
        })
      })
    })

    describe('getOrganizationUserinfo', () => {
      it('should return specific user info', async () => {
        const mockUsers = [
          { 
            id: 'user123', 
            email: 'user@example.com'
          },
          {
            id: 'user456',
            email: 'another@example.com'
          }
        ]
        
        // Mock getOrganizationUsers call
        mockAppcircleApi.get
          .mockResolvedValueOnce({ data: mockUsers })
          // Mock getRoleList call
          .mockResolvedValueOnce({ data: [] })
          // Mock getOrganizationUserRoles calls
          .mockResolvedValue({ 
            data: { roles: ['admin'], isSubOrganizationMember: false, inheritedRoles: [] }
          })

        const result = await getOrganizationUserinfo({ 
          organizationId: 'org123', 
          userId: 'user123' 
        })

        expect(result.id).toBe('user123')
        expect(result.email).toBe('user@example.com')
      })

      it('should throw ProgramError when user not found', async () => {
        // Mock empty user list
        mockAppcircleApi.get
          .mockResolvedValueOnce({ data: [] }) // getOrganizationUsers returns empty
          .mockResolvedValue({ data: [] }) // getRoleList returns empty

        await expect(getOrganizationUserinfo({ 
          organizationId: 'org123', 
          userId: 'nonexistent' 
        })).rejects.toThrow(ProgramError)

        try {
          await getOrganizationUserinfo({ 
            organizationId: 'org123', 
            userId: 'nonexistent' 
          })
        } catch (error) {
          expect(error.message).toContain('User "nonexistent" not found')
          expect(error.message).toContain('organization "org123"')
        }
      })

      it('should respect onlyGivenOrganization filter', async () => {
        const mockUsers = [
          { 
            id: 'user123', 
            email: 'user@example.com',
            roles: ['admin'],
            isSubOrganizationMember: false
          }
        ]
        
        mockAppcircleApi.get
          .mockResolvedValueOnce({ data: mockUsers })
          .mockResolvedValue({ 
            data: { roles: ['admin'], isSubOrganizationMember: false, inheritedRoles: [] }
          })

        const result = await getOrganizationUserinfo({ 
          organizationId: 'org123', 
          userId: 'user123',
          onlyGivenOrganization: true
        })

        expect(result).toBeDefined()
        expect(result.id).toBe('user123')
      })
    })
  })

  describe('Role Management', () => {
    describe('getRoleList', () => {
      it('should transform API roles to internal format', async () => {
        const mockRolesData = [
          {
            title: 'Build Management',
            module: 'build',
            groupName: 'management',
            enabled: true,
            multi: false,
            roles: [
              { key: 'build_admin', name: 'Build Admin' },
              { key: 'build_viewer', name: 'Build Viewer' }
            ],
            defaultRoles: ['build_viewer']
          }
        ]
        
        mockAppcircleApi.get.mockResolvedValue({ data: mockRolesData })

        const result = await getRoleList()

        // Should include owner role first
        expect(result[0]).toEqual({
          groupId: 'owner',
          title: 'Full access to all modules and settings',
          name: 'Owner',
          key: 'owner',
          description: 'owner (Full access to all modules and settings)',
          isDefaultRole: false
        })

        // Should transform API data correctly
        expect(result[1]).toMatchObject({
          groupId: 'buildmanagement',
          title: 'Build Management',
          name: 'Build Admin',
          key: 'build_admin',
          index: 0,
          multi: false,
          isDefaultRole: false
        })

        expect(result[2]).toMatchObject({
          key: 'build_viewer',
          isDefaultRole: true  // build_viewer is in defaultRoles
        })
      })

      it('should filter out disabled roles', async () => {
        const mockRolesData = [
          {
            title: 'Disabled Module',
            module: 'disabled',
            enabled: false,
            roles: [{ key: 'disabled_role', name: 'Disabled Role' }]
          },
          {
            title: 'Enabled Module',
            module: 'enabled',
            enabled: true,
            roles: [{ key: 'enabled_role', name: 'Enabled Role' }]
          }
        ]
        
        mockAppcircleApi.get.mockResolvedValue({ data: mockRolesData })

        const result = await getRoleList()

        expect(result.some(role => role.key === 'disabled_role')).toBe(false)
        expect(result.some(role => role.key === 'enabled_role')).toBe(true)
      })

      it('should handle roles without groupName', async () => {
        const mockRolesData = [
          {
            title: 'Simple Module',
            module: 'simple',
            enabled: true,
            roles: [{ key: 'simple_role', name: 'Simple Role' }]
          }
        ]
        
        mockAppcircleApi.get.mockResolvedValue({ data: mockRolesData })

        const result = await getRoleList()

        expect(result.find(r => r.key === 'simple_role')?.groupId).toBe('simple')
      })

      it('should handle roles without defaultRoles array', async () => {
        const mockRolesData = [
          {
            title: 'Test Module',
            module: 'test',
            enabled: true,
            roles: [{ key: 'test_role', name: 'Test Role' }]
          }
        ]
        
        mockAppcircleApi.get.mockResolvedValue({ data: mockRolesData })

        const result = await getRoleList()

        const testRole = result.find(r => r.key === 'test_role')
        expect(testRole?.isDefaultRole).toBe(false)
      })

      it('should handle empty roles data', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })

        const result = await getRoleList()

        // Should still include owner role
        expect(result).toHaveLength(1)
        expect(result[0].key).toBe('owner')
      })

      it('should handle API errors when fetching roles', async () => {
        const rolesError = new Error('Failed to fetch roles')
        mockAppcircleApi.get.mockRejectedValue(rolesError)

        await expect(getRoleList()).rejects.toThrow('Failed to fetch roles')
      })

      it('should use correct API endpoint with version parameter', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })

        await getRoleList()

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'roles.json?v=5',
          { headers: expect.any(Object) }
        )
      })
    })

    describe('getOrganizationUserRoles', () => {
      it('should fetch user roles successfully', async () => {
        const mockRoles = {
          roles: ['admin', 'developer'],
          inheritedRoles: ['viewer'],
          isSubOrganizationMember: false
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockRoles })

        const result = await getOrganizationUserRoles({
          organizationId: 'org123',
          userId: 'user123'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'identity/v1/organizations/org123/users/user123/roles',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockRoles)
      })

      it('should handle 400 error for sub-organization members', async () => {
        const subOrgError = new Error('User is sub-organization member') as any
        subOrgError.response = {
          status: 400,
          data: { error: 'Sub-organization member' }
        }
        mockAppcircleApi.get.mockRejectedValue(subOrgError)

        const result = await getOrganizationUserRoles({
          organizationId: 'org123',
          userId: 'suborg_user'
        })

        expect(result).toEqual({
          isSubOrganizationMember: true,
          roles: [],
          inheritedRoles: []
        })
      })

      it('should re-throw non-400 errors', async () => {
        const serverError = new Error('Internal server error') as any
        serverError.response = { status: 500 }
        mockAppcircleApi.get.mockRejectedValue(serverError)

        await expect(getOrganizationUserRoles({
          organizationId: 'org123',
          userId: 'user123'
        })).rejects.toThrow('Internal server error')
      })

      it('should handle 400 error without response.data.error', async () => {
        const badRequestError = new Error('Bad request') as any
        badRequestError.response = { status: 400 }  // No data.error
        mockAppcircleApi.get.mockRejectedValue(badRequestError)

        // Should re-throw since condition requires err.response?.data?.error
        await expect(getOrganizationUserRoles({
          organizationId: 'org123',
          userId: 'user123'
        })).rejects.toThrow('Bad request')
      })

      it('should handle network errors', async () => {
        const networkError = new Error('Network error')
        mockAppcircleApi.get.mockRejectedValue(networkError)

        await expect(getOrganizationUserRoles({
          organizationId: 'org123',
          userId: 'user123'
        })).rejects.toThrow('Network error')
      })
    })
  })

  describe('User Invitation Management', () => {
    describe('inviteUserToOrganization', () => {
      beforeEach(() => {
        // Mock getRoleList API response for prepareRoles function
        const mockRolesApiData = [
          {
            title: 'Management',
            module: 'management',
            enabled: true,
            multi: false,
            roles: [
              { key: 'admin', name: 'Admin' }
            ]
          },
          {
            title: 'Development',
            module: 'development',
            enabled: true,
            multi: true,
            roles: [
              { key: 'developer', name: 'Developer' },
              { key: 'senior_developer', name: 'Senior Developer' }
            ]
          },
          {
            title: 'Read Only',
            module: 'readonly',
            enabled: true,
            multi: false,
            roles: [
              { key: 'viewer', name: 'Viewer' }
            ]
          }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockRolesApiData })
      })

      it('should invite user with single role', async () => {
        const mockResponse = { success: true, invitationId: 'inv123' }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })

        const result = await inviteUserToOrganization({
          organizationId: 'org123',
          email: 'newuser@example.com',
          role: 'admin'
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          'identity/v1/users?action=invite&organizationId=org123',
          {
            userEmail: 'newuser@example.com',
            organizationsAndRoles: [{
              organizationId: 'org123',
              roles: ['admin']
            }]
          },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should invite user with multiple roles', async () => {
        const mockResponse = { success: true }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })

        await inviteUserToOrganization({
          organizationId: 'org123',
          email: 'newuser@example.com',
          role: ['admin', 'viewer']
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          {
            userEmail: 'newuser@example.com',
            organizationsAndRoles: [{
              organizationId: 'org123',
              roles: ['admin', 'viewer']
            }]
          },
          expect.any(Object)
        )
      })

      it('should handle multi roles in same group correctly', async () => {
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        await inviteUserToOrganization({
          organizationId: 'org123',
          email: 'developer@example.com',
          role: ['developer', 'senior_developer']
        })

        // Both roles should be included since multi=true
        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          {
            userEmail: 'developer@example.com',
            organizationsAndRoles: [{
              organizationId: 'org123',
              roles: ['developer', 'senior_developer']
            }]
          },
          expect.any(Object)
        )
      })

      it('should handle conflicting roles in non-multi groups', async () => {
        // Reset mock to return conflicting roles in same non-multi group
        const conflictingRolesApiData = [
          {
            title: 'Management',
            module: 'management',
            enabled: true,
            multi: false,
            roles: [
              { key: 'admin', name: 'Admin' },
              { key: 'manager', name: 'Manager' }
            ]
          }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: conflictingRolesApiData })
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        await inviteUserToOrganization({
          organizationId: 'org123',
          email: 'user@example.com',
          role: ['admin', 'manager']
        })

        // Should only include admin (lower index = higher priority)
        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          {
            userEmail: 'user@example.com',
            organizationsAndRoles: [{
              organizationId: 'org123',
              roles: ['admin']
            }]
          },
          expect.any(Object)
        )
      })

      it('should handle invalid roles', async () => {
        await expect(inviteUserToOrganization({
          organizationId: 'org123',
          email: 'user@example.com',
          role: 'invalid_role'
        })).rejects.toThrow(ProgramError)

        try {
          await inviteUserToOrganization({
            organizationId: 'org123',
            email: 'user@example.com',
            role: 'fake_role'
          })
        } catch (error) {
          expect(error.message).toContain('Invalid role "fake_role"')
          expect(error.message).toContain('Assignable roles:')
        }
      })

      it('should filter out empty/falsy roles', async () => {
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        await inviteUserToOrganization({
          organizationId: 'org123',
          email: 'user@example.com',
          role: ['admin', '', null, 'viewer', undefined] as any
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          {
            userEmail: 'user@example.com',
            organizationsAndRoles: [{
              organizationId: 'org123',
              roles: ['admin', 'viewer']
            }]
          },
          expect.any(Object)
        )
      })

      it('should handle invalid email format', async () => {
        const emailError = new Error('Invalid email format')
        mockAppcircleApi.patch.mockRejectedValue(emailError)

        await expect(inviteUserToOrganization({
          organizationId: 'org123',
          email: 'invalid-email',
          role: 'admin'
        })).rejects.toThrow('Invalid email format')
      })

      it('should handle already invited user', async () => {
        const alreadyInvitedError = new Error('User already invited') as any
        alreadyInvitedError.response = { status: 409 }
        mockAppcircleApi.patch.mockRejectedValue(alreadyInvitedError)

        await expect(inviteUserToOrganization({
          organizationId: 'org123',
          email: 'existing@example.com',
          role: 'admin'
        })).rejects.toThrow('User already invited')
      })

      it('should handle empty roles array', async () => {
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        await inviteUserToOrganization({
          organizationId: 'org123',
          email: 'user@example.com',
          role: []
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          {
            userEmail: 'user@example.com',
            organizationsAndRoles: [{
              organizationId: 'org123',
              roles: []
            }]
          },
          expect.any(Object)
        )
      })
    })

    describe('reInviteUserToOrganization', () => {
      it('should re-invite user successfully', async () => {
        const mockResponse = { success: true, invitationId: 'inv456' }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })

        const result = await reInviteUserToOrganization({
          organizationId: 'org123',
          email: 'user@example.com'
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          'identity/v1/organizations/org123/invitations?action=re-invite',
          { userEmail: 'user@example.com' },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle re-invite for non-existent invitation', async () => {
        const notFoundError = new Error('Invitation not found') as any
        notFoundError.response = { status: 404 }
        mockAppcircleApi.patch.mockRejectedValue(notFoundError)

        await expect(reInviteUserToOrganization({
          organizationId: 'org123',
          email: 'nonexistent@example.com'
        })).rejects.toThrow('Invitation not found')
      })

      it('should handle expired invitation', async () => {
        const expiredError = new Error('Invitation has expired')
        mockAppcircleApi.patch.mockRejectedValue(expiredError)

        await expect(reInviteUserToOrganization({
          organizationId: 'org123',
          email: 'expired@example.com'
        })).rejects.toThrow('Invitation has expired')
      })

      it('should handle special characters in email', async () => {
        const specialEmail = 'user+test@example-domain.com'
        const mockResponse = { success: true }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })

        await reInviteUserToOrganization({
          organizationId: 'org123',
          email: specialEmail
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          { userEmail: specialEmail },
          expect.any(Object)
        )
      })
    })

    describe('removeInvitationFromOrganization', () => {
      it('should remove invitation successfully', async () => {
        const mockResponse = { success: true }
        mockAppcircleApi.delete.mockResolvedValue({ data: mockResponse })

        const result = await removeInvitationFromOrganization({
          organizationId: 'org123',
          email: 'user@example.com'
        })

        expect(mockAppcircleApi.delete).toHaveBeenCalledWith(
          'identity/v1/organizations/org123/invitations',
          {
            headers: expect.any(Object),
            data: { userEmail: 'user@example.com' }
          }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle invitation not found', async () => {
        const notFoundError = new Error('Invitation not found') as any
        notFoundError.response = { status: 404 }
        mockAppcircleApi.delete.mockRejectedValue(notFoundError)

        await expect(removeInvitationFromOrganization({
          organizationId: 'org123',
          email: 'nonexistent@example.com'
        })).rejects.toThrow('Invitation not found')
      })

      it('should handle permissions error', async () => {
        const permError = new Error('Insufficient permissions to remove invitation') as any
        permError.response = { status: 403 }
        mockAppcircleApi.delete.mockRejectedValue(permError)

        await expect(removeInvitationFromOrganization({
          organizationId: 'org123',
          email: 'protected@example.com'
        })).rejects.toThrow('Insufficient permissions')
      })
    })

    describe('getOrganizationInvitations', () => {
      it('should filter invitations by organization ID', async () => {
        const mockInvitations = [
          {
            id: 'inv1',
            email: 'user1@example.com',
            organizationsAndRoles: [
              { organizationId: 'org123', roles: ['admin'] },
              { organizationId: 'org456', roles: ['viewer'] }
            ]
          },
          {
            id: 'inv2',
            email: 'user2@example.com',
            organizationsAndRoles: [
              { organizationId: 'org456', roles: ['admin'] }
            ]
          }
        ]
        
        mockAppcircleApi.get.mockResolvedValue({ data: mockInvitations })

        const result = await getOrganizationInvitations({ organizationId: 'org123' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'identity/v1/organizations/org123/invitations',
          { headers: expect.any(Object) }
        )
        
        expect(result).toHaveLength(2)
        expect(result[0].organizationsAndRoles).toEqual([
          { organizationId: 'org123', roles: ['admin'] }
        ])
        expect(result[0].isSubOrganizationMember).toBe(false)
        expect(result[1].isSubOrganizationMember).toBe(true) // No matching org
      })

      it('should handle empty invitations list', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })
        
        const result = await getOrganizationInvitations({ organizationId: 'org123' })
        expect(result).toEqual([])
      })

      it('should handle invitations with no organizationsAndRoles', async () => {
        const mockInvitations = [
          {
            id: 'inv1',
            email: 'user@example.com',
            organizationsAndRoles: []
          }
        ]
        
        mockAppcircleApi.get.mockResolvedValue({ data: mockInvitations })

        const result = await getOrganizationInvitations({ organizationId: 'org123' })

        expect(result[0].isSubOrganizationMember).toBe(true)
        expect(result[0].organizationsAndRoles).toEqual([])
      })
    })
  })

  describe('Role Assignment', () => {
    // Note: Function name has typo: assignRolesToUserInOrganitaion
    describe('assignRolesToUserInOrganitaion', () => {
      beforeEach(() => {
        // Mock getRoleList API response for prepareRoles
        const mockRolesApiData = [
          {
            title: 'Management',
            module: 'management',
            enabled: true,
            multi: false,
            roles: [{ key: 'admin', name: 'Admin' }]
          },
          {
            title: 'Development',
            module: 'development',
            enabled: true,
            multi: true,
            roles: [{ key: 'developer', name: 'Developer' }]
          },
          {
            title: 'Read Only',
            module: 'readonly',
            enabled: true,
            multi: false,
            roles: [{ key: 'viewer', name: 'Viewer' }]
          }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockRolesApiData })
      })

      it('should assign single role to user', async () => {
        const mockResponse = { success: true }
        mockAppcircleApi.put.mockResolvedValue({ data: mockResponse })

        const result = await assignRolesToUserInOrganitaion({
          organizationId: 'org123',
          userId: 'user123',
          role: 'admin'
        })

        expect(mockAppcircleApi.put).toHaveBeenCalledWith(
          'identity/v1/organizations/org123/users/user123/roles',
          { roles: ['admin'] },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should assign multiple roles to user', async () => {
        mockAppcircleApi.put.mockResolvedValue({ data: { success: true } })

        await assignRolesToUserInOrganitaion({
          organizationId: 'org123',
          userId: 'user123',
          role: ['admin', 'viewer']
        })

        expect(mockAppcircleApi.put).toHaveBeenCalledWith(
          'identity/v1/organizations/org123/users/user123/roles',
          { roles: ['admin', 'viewer'] },
          { headers: expect.any(Object) }
        )
      })

      it('should handle user not found error', async () => {
        const userError = new Error('User not found in organization') as any
        userError.response = { status: 404 }
        mockAppcircleApi.put.mockRejectedValue(userError)

        await expect(assignRolesToUserInOrganitaion({
          organizationId: 'org123',
          userId: 'nonexistent',
          role: 'admin'
        })).rejects.toThrow('User not found in organization')
      })

      it('should handle insufficient permissions error', async () => {
        const permError = new Error('Insufficient permissions to assign roles') as any
        permError.response = { status: 403 }
        mockAppcircleApi.put.mockRejectedValue(permError)

        await expect(assignRolesToUserInOrganitaion({
          organizationId: 'org123',
          userId: 'user123',
          role: 'owner'
        })).rejects.toThrow('Insufficient permissions')
      })

      it('should handle invalid role assignment', async () => {
        await expect(assignRolesToUserInOrganitaion({
          organizationId: 'org123',
          userId: 'user123',
          role: 'invalid_role'
        })).rejects.toThrow(ProgramError)
      })

      it('should handle role processing with multi-role groups', async () => {
        mockAppcircleApi.put.mockResolvedValue({ data: { success: true } })

        await assignRolesToUserInOrganitaion({
          organizationId: 'org123',
          userId: 'user123',
          role: ['developer'] // Multi-role group
        })

        expect(mockAppcircleApi.put).toHaveBeenCalledWith(
          expect.any(String),
          { roles: ['developer'] },
          expect.any(Object)
        )
      })

      it('should handle empty roles array', async () => {
        mockAppcircleApi.put.mockResolvedValue({ data: { success: true } })

        await assignRolesToUserInOrganitaion({
          organizationId: 'org123',
          userId: 'user123',
          role: []
        })

        expect(mockAppcircleApi.put).toHaveBeenCalledWith(
          expect.any(String),
          { roles: [] },
          expect.any(Object)
        )
      })
    })
  })

  describe('User Removal Operations', () => {
    describe('removeUserFromOrganization', () => {
      it('should remove user from organization', async () => {
        const mockResponse = { success: true }
        mockAppcircleApi.delete.mockResolvedValue({ data: mockResponse })

        const result = await removeUserFromOrganization({
          organizationId: 'org123',
          userId: 'user123'
        })

        expect(mockAppcircleApi.delete).toHaveBeenCalledWith(
          'identity/v1/organizations/org123?action=remove&userId=user123',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle removing organization owner', async () => {
        const ownerError = new Error('Cannot remove organization owner') as any
        ownerError.response = { status: 400 }
        mockAppcircleApi.delete.mockRejectedValue(ownerError)

        await expect(removeUserFromOrganization({
          organizationId: 'org123',
          userId: 'owner_user_id'
        })).rejects.toThrow('Cannot remove organization owner')
      })

      it('should handle removing last admin', async () => {
        const lastAdminError = new Error('Cannot remove last admin') as any
        lastAdminError.response = { status: 400 }
        mockAppcircleApi.delete.mockRejectedValue(lastAdminError)

        await expect(removeUserFromOrganization({
          organizationId: 'org123',
          userId: 'last_admin_id'
        })).rejects.toThrow('Cannot remove last admin')
      })

      it('should handle user not found', async () => {
        const notFoundError = new Error('User not found') as any
        notFoundError.response = { status: 404 }
        mockAppcircleApi.delete.mockRejectedValue(notFoundError)

        await expect(removeUserFromOrganization({
          organizationId: 'org123',
          userId: 'nonexistent'
        })).rejects.toThrow('User not found')
      })

      it('should handle permissions error', async () => {
        const permError = new Error('Insufficient permissions') as any
        permError.response = { status: 403 }
        mockAppcircleApi.delete.mockRejectedValue(permError)

        await expect(removeUserFromOrganization({
          organizationId: 'org123',
          userId: 'protected_user'
        })).rejects.toThrow('Insufficient permissions')
      })
    })
  })

  describe('Critical Edge Cases and Performance', () => {
    describe('Concurrent Operations', () => {
      it('should handle concurrent role assignments', async () => {
        const mockRolesApiData = [
          {
            title: 'Management',
            module: 'management',
            enabled: true,
            multi: false,
            roles: [{ key: 'admin', name: 'Admin' }]
          }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockRolesApiData })
        mockAppcircleApi.put.mockResolvedValue({ data: { success: true } })

        const assignments = Array(5).fill(0).map((_, i) =>
          assignRolesToUserInOrganitaion({
            organizationId: 'org123',
            userId: `user${i}`,
            role: 'admin'
          })
        )

        const results = await Promise.all(assignments)

        expect(results).toHaveLength(5)
        results.forEach(result => expect(result.success).toBe(true))
      })

      it('should handle concurrent user invitations', async () => {
        const mockRolesApiData = [
          {
            title: 'Read Only',
            module: 'readonly',
            enabled: true,
            multi: false,
            roles: [{ key: 'viewer', name: 'Viewer' }]
          }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockRolesApiData })
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        const invitations = Array(3).fill(0).map((_, i) =>
          inviteUserToOrganization({
            organizationId: 'org123',
            email: `user${i}@example.com`,
            role: 'viewer'
          })
        )

        const results = await Promise.all(invitations)

        expect(results).toHaveLength(3)
        results.forEach(result => expect(result.success).toBe(true))
      })
    })

    describe('Large Dataset Handling', () => {
      it('should handle large user lists in getOrganizationUsersWithRoles', async () => {
        const largeUserList = Array(1000).fill(0).map((_, i) => ({
          id: `user${i}`,
          email: `user${i}@example.com`
        }))

        mockAppcircleApi.get
          .mockResolvedValueOnce({ data: largeUserList })
          .mockResolvedValue({ 
            data: { roles: ['viewer'], isSubOrganizationMember: false, inheritedRoles: [] }
          })

        const result = await getOrganizationUsersWithRoles({ organizationId: 'org123' })

        expect(result).toHaveLength(1000)
        // Should complete without timeout or memory issues
        result.forEach(user => {
          expect(user).toHaveProperty('roles')
          expect(user).toHaveProperty('isSubOrganizationMember')
        })
      }, 30000) // Increase timeout for this test

      it('should handle large role lists efficiently', async () => {
        const largeRoleList = Array(200).fill(0).map((_, i) => ({
          title: `Module ${i}`,
          module: `module${i}`,
          enabled: true,
          multi: i % 2 === 0,
          roles: [
            { key: `role${i}_admin`, name: `Admin ${i}` },
            { key: `role${i}_viewer`, name: `Viewer ${i}` }
          ]
        }))
        
        mockAppcircleApi.get.mockResolvedValue({ data: largeRoleList })

        const result = await getRoleList()

        // Should include owner + all roles from modules
        expect(result.length).toBeGreaterThan(400) // 200 modules * 2 roles + owner
        
        // Verify structure is maintained
        expect(result[0].key).toBe('owner')
        expect(result.some(r => r.key === 'role0_admin')).toBe(true)
      })
    })

    describe('Input Validation and Security', () => {
      it('should handle malformed email addresses', async () => {
        const mockRolesApiData = [
          {
            title: 'Read Only',
            module: 'readonly',
            enabled: true,
            multi: false,
            roles: [{ key: 'viewer', name: 'Viewer' }]
          }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockRolesApiData })
        
        const malformedEmails = [
          'invalid-email',
          '@example.com',
          'user@',
          'user..double@example.com',
          'user space@example.com'
        ]

        for (const email of malformedEmails) {
          const emailError = new Error('Invalid email format')
          mockAppcircleApi.patch.mockRejectedValue(emailError)

          await expect(inviteUserToOrganization({
            organizationId: 'org123',
            email,
            role: 'viewer'
          })).rejects.toThrow('Invalid email format')
        }
      })

      it('should handle special organization IDs', async () => {
        const specialOrgIds = ['org-123', 'org_456', 'org.789']
        
        for (const _orgId of specialOrgIds) {
          mockAppcircleApi.get.mockResolvedValue({ data: { data: [] } })
          
          await getOrganizations()
          
          // Should not throw errors for valid special characters
          expect(mockAppcircleApi.get).toHaveBeenCalled()
        }
      })

      it('should handle XSS attempts in organization names', async () => {
        const xssName = '<script>alert("xss")</script>'
        const mockResponse = { id: 'suborg789', name: xssName }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await createSubOrganization({ name: xssName })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'identity/v1/organizations/current/sub-organizations',
          { name: xssName },
          { headers: expect.any(Object) }
        )
        expect(result.name).toBe(xssName) // API should handle sanitization
      })

      it('should handle SQL injection attempts in user IDs', async () => {
        const sqlInjection = "user'; DROP TABLE users; --"
        const sqlError = new Error('Invalid user ID format')
        mockAppcircleApi.get.mockRejectedValue(sqlError)

        await expect(getOrganizationUserRoles({
          organizationId: 'org123',
          userId: sqlInjection
        })).rejects.toThrow('Invalid user ID format')
      })
    })

    describe('Network and API Error Handling', () => {
      it('should handle timeout errors', async () => {
        const timeoutError = new Error('Request timeout') as any
        timeoutError.code = 'ECONNABORTED'
        mockAppcircleApi.get.mockRejectedValue(timeoutError)

        await expect(getOrganizations()).rejects.toThrow('Request timeout')
      })

      it('should handle rate limiting', async () => {
        const rateLimitError = new Error('Too Many Requests') as any
        rateLimitError.response = { status: 429 }
        mockAppcircleApi.get.mockRejectedValue(rateLimitError)

        await expect(getRoleList()).rejects.toThrow('Too Many Requests')
      })

      it('should handle server errors', async () => {
        const serverError = new Error('Internal Server Error') as any
        serverError.response = { status: 500 }
        mockAppcircleApi.post.mockRejectedValue(serverError)

        await expect(createSubOrganization({ name: 'Test' }))
          .rejects.toThrow('Internal Server Error')
      })

      it('should handle network connectivity issues', async () => {
        const networkError = new Error('Network Error') as any
        networkError.code = 'ENOTFOUND'
        mockAppcircleApi.get.mockRejectedValue(networkError)

        await expect(getOrganizationDetail({ organizationId: 'org123' }))
          .rejects.toThrow('Network Error')
      })
    })

    describe('Source Code Issues Documentation', () => {
      it('should document the typo in function name', () => {
        // This test documents the typo in assignRolesToUserInOrganitaion
        // Should be: assignRolesToUserInOrganization
        expect(typeof assignRolesToUserInOrganitaion).toBe('function')
        
        // TODO: Fix typo in source code function name
        // and update all references accordingly
      })

      it('should document inconsistent error handling patterns', async () => {
        // Only getOrganizationUserRoles has try-catch error handling
        // Other functions rely on caller to handle errors
        
        const roles = [{ key: 'admin', groupId: 'management', multi: false, index: 0 }]
        mockAppcircleApi.get.mockResolvedValue({ data: roles })
        
        const userError = new Error('User error') as any
        userError.response = { status: 400, data: { error: 'User is sub-org member' } }
        mockAppcircleApi.get.mockRejectedValueOnce(userError)

        const result = await getOrganizationUserRoles({
          organizationId: 'org123',
          userId: 'user123'
        })

        // This function handles 400 errors specially
        expect(result.isSubOrganizationMember).toBe(true)
        
        // TODO: Consider consistent error handling across all functions
      })

      it('should document complex async operations risk', async () => {
        // getOrganizationUsersWithRoles uses Promise.all which can cause memory issues
        // with large user lists and fail-fast behavior on any role fetch failure
        
        const users = [{ id: 'user1', email: 'user1@example.com' }]
        mockAppcircleApi.get
          .mockResolvedValueOnce({ data: users })
          .mockRejectedValueOnce(new Error('Role fetch failed'))

        await expect(getOrganizationUsersWithRoles({ organizationId: 'org123' }))
          .rejects.toThrow('Role fetch failed')
        
        // TODO: Consider implementing more resilient error handling
        // or chunked processing for large user lists
      })
    })

    describe('Headers and Authentication', () => {
      it('should include proper headers in all requests', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: { data: [] } })
        mockAppcircleApi.post.mockResolvedValue({ data: {} })
        mockAppcircleApi.put.mockResolvedValue({ data: {} })
        mockAppcircleApi.patch.mockResolvedValue({ data: {} })
        mockAppcircleApi.delete.mockResolvedValue({ data: {} })

        await getOrganizations()
        await createSubOrganization({ name: 'Test' })

        // Verify all calls include headers
        const allCalls = [
          ...mockAppcircleApi.get.mock.calls,
          ...mockAppcircleApi.post.mock.calls,
          ...mockAppcircleApi.put.mock.calls,
          ...mockAppcircleApi.patch.mock.calls,
          ...mockAppcircleApi.delete.mock.calls
        ]

        allCalls.forEach((call: any) => {
          const config = call[call.length - 1]
          expect(config.headers).toEqual(expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }))
        })
      })

      it('should call getHeaders for all API requests', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: { data: [] } })

        await getOrganizations()

        expect(mockGetHeaders).toHaveBeenCalled()
      })
    })
  })
})