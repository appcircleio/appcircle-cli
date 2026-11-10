import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatRelativeDate,
  formatDuration,
  formatEnabledStatus,
  transformBuildProfile,
  transformBranch,
  transformCommit,
  transformActiveBuild,
  transformOrganizationList,
  transformOrganizationDetails,
  transformUser,
  transformInvitation,
  processRolesWithInheritance
} from '../../../src/core/writer-utilities'

describe('writer-utilities formatters and transformers', () => {
  describe('formatters', () => {
    it('returns the fallback when moment cannot read the date', () => {
      const unreadable = Symbol('date') as any

      expect(formatDate(unreadable, 'n/a')).toBe('n/a')
      expect(formatRelativeDate(unreadable, 'n/a')).toBe('n/a')
    })

    it('omits zero minutes from a duration', () => {
      expect(formatDuration('01:00:05')).toBe('1 hours 5 seconds')
    })

    it('returns "-" for a duration below one second', () => {
      expect(formatDuration(500)).toBe('-')
    })

    it('treats a value that is neither boolean nor number as disabled', () => {
      expect(formatEnabledStatus('yes' as any, 'On', 'Off')).toBe('Off')
    })
  })

  describe('build transformers', () => {
    it('shows a placeholder when a build profile has no repository', () => {
      expect(transformBuildProfile({ id: 'p1', name: 'App' }).Repository).toBe('No repository connected')
    })

    it('transforms a branch without builds', () => {
      expect(transformBranch({ id: 'b1', name: 'main' })).toEqual({
        'Branch Id': 'b1',
        'Branch Name': 'main',
        'Last Build': 'No previous builds',
        'Build Status': 'No previous builds'
      })
    })

    it('transforms a branch with a known build status', () => {
      expect(transformBranch({ id: 'b1', name: 'main', buildStatus: 1 })['Build Status']).toBe('Failed')
    })

    it('transforms commits with and without author and message', () => {
      expect(transformCommit({ id: 'c1', hash: 'abc', author: 'dev', message: 'fix' })).toEqual({
        'Commit Id': 'c1',
        Hash: 'abc',
        Date: 'Could not find date',
        Author: 'dev',
        Message: 'fix'
      })
      expect(transformCommit({ id: 'c2', hash: 'def' })).toMatchObject({ Author: '', Message: '' })
    })

    it('transforms active builds with and without optional fields', () => {
      expect(
        transformActiveBuild({
          id: 'q1',
          commitId: 'c1',
          commitHash: 'abc',
          profileName: 'App',
          branchName: 'main',
          queueItemStatus: 1
        })
      ).toEqual({
        'Build Id': 'q1',
        'Commit Id': 'c1',
        'Commit Hash': 'abc',
        'Profile Name': 'App',
        'Branch Name': 'main',
        Status: 'Running'
      })
      expect(transformActiveBuild({ id: 'q2', commitId: 'c2' })).toEqual({
        'Build Id': 'q2',
        'Commit Id': 'c2',
        'Commit Hash': '-',
        'Profile Name': '-',
        'Branch Name': '-',
        Status: '-'
      })
    })
  })

  describe('organization transformers', () => {
    it('transforms a sub organization in list view', () => {
      expect(
        transformOrganizationList({
          id: 'o1',
          name: 'Sub',
          givenId: 'sub-1',
          ssoEnabled: true,
          disabled: false,
          rootOrganizationName: 'Root',
          rootOrganizationId: 'r1'
        })
      ).toEqual({
        Name: 'Sub',
        Id: 'o1',
        'Given Id': 'sub-1',
        'SSO Enabled': 'Yes',
        Disabled: 'No',
        'Root Organization': 'Root',
        'Root Organization Id': 'r1',
        'Created Date': '-'
      })
    })

    it('transforms a root organization in list view with placeholders', () => {
      expect(transformOrganizationList({ id: 'o2', name: 'Root' })).toEqual({
        Name: 'Root',
        Id: 'o2',
        'Given Id': '-',
        'SSO Enabled': '-',
        Disabled: '-',
        'Root Organization': '-',
        'Root Organization Id': '-',
        'Created Date': '-'
      })
    })

    it('shows the member count in detail view', () => {
      expect(transformOrganizationDetails({ id: 'o1', name: 'Org', memberCount: 12 }).Members).toBe(12)
    })

    it('shows a placeholder for a missing member count in detail view', () => {
      expect(transformOrganizationDetails({ id: 'o1', name: 'Org', givenId: 'g1' })).toEqual({
        Name: 'Org',
        Id: 'o1',
        'Given Id': 'g1',
        Members: '-',
        SSO: '-',
        Created: '-',
        'Root Org.': '-',
        'Root Org. Id': '-',
        'Logo Url': '-'
      })
    })
  })

  describe('user and invitation transformers', () => {
    it('transforms a root organization user with roles', () => {
      expect(
        transformUser({ id: 'u1', username: 'dev', email: 'dev@example.test', roles: ['owner', 'build_view'] })
      ).toEqual({
        'User Name': 'dev',
        Id: 'u1',
        InRootOrg: 'Yes',
        Email: 'dev@example.test',
        Roles: 'owner,build_view'
      })
    })

    it('transforms a sub organization user without email and roles', () => {
      expect(transformUser({ id: 'u2', username: 'guest', isSubOrganizationMember: true })).toEqual({
        'User Name': 'guest',
        Id: 'u2',
        InRootOrg: 'No',
        Email: '-',
        Roles: '-'
      })
    })

    it('transforms invitations with and without roles', () => {
      expect(
        transformInvitation({
          userEmail: 'a@example.test',
          rootOrganizationId: 'r1',
          organizationsAndRoles: [{ roles: ['owner', 'dist_view'] }],
          status: 'Pending'
        })
      ).toEqual({
        'User Email': 'a@example.test',
        'Root Organization ID': 'r1',
        InRootOrg: 'Yes',
        Roles: 'owner,dist_view',
        Status: 'Pending'
      })
      expect(
        transformInvitation({ userEmail: 'b@example.test', rootOrganizationId: 'r1', isSubOrganizationMember: true })
      ).toEqual({
        'User Email': 'b@example.test',
        'Root Organization ID': 'r1',
        InRootOrg: 'No',
        Roles: '-',
        Status: '-'
      })
    })
  })

  describe('processRolesWithInheritance', () => {
    it('lists regular roles when there are no inherited roles', () => {
      expect(processRolesWithInheritance(['owner'])).toEqual([{ Role: 'owner', Inheritance: '-' }])
    })

    it('moves a role that is both regular and inherited behind the regular ones', () => {
      expect(processRolesWithInheritance(['viewer', 'admin'], ['viewer'])).toEqual([
        { Role: 'admin', Inheritance: '-' },
        { Role: 'viewer', Inheritance: 'Inherit' }
      ])
    })
  })
})
