import { describe, it, expect, vi } from 'vitest'
import { ProgramError } from '../../../src/core/ProgramError'
import {
  createPersonalAccessKeyAuthData,
  handleAPIKeyAuthError,
  determineBuildIdForDownload,
  sortBuildsByDate
} from '../../../src/services/index-utilities'

describe('index-utilities edge cases', () => {
  it('rejects an empty personal access key', () => {
    expect(() => createPersonalAccessKeyAuthData('   ')).toThrow(ProgramError)
    expect(() => createPersonalAccessKeyAuthData('   ')).toThrow('Invalid Personal Access Key format provided')
  })

  it('uses a generic message for a 400 response without an error body', () => {
    expect(() => handleAPIKeyAuthError({ response: { status: 400 } })).toThrow('Invalid request: Bad request format')
  })

  it('keeps the given build ID when the latest build lookup returns nothing', async () => {
    const getLatestBuildId = vi.fn().mockResolvedValue(null)
    const getBuildsOfCommit = vi.fn()

    const result = await determineBuildIdForDownload(
      { buildId: 'given-build', commitId: 'c1', branchId: 'b1', profileId: 'p1' },
      getLatestBuildId,
      getBuildsOfCommit
    )

    expect(result).toEqual({ buildId: 'given-build' })
    expect(getLatestBuildId).toHaveBeenCalledWith({ branchId: 'b1', profileId: 'p1' })
    expect(getBuildsOfCommit).not.toHaveBeenCalled()
  })

  it('sorts builds without a start date after dated builds', () => {
    const sorted = sortBuildsByDate([
      { id: 'undated-1' },
      { id: 'old', startDate: '2024-01-01T00:00:00Z' },
      { id: 'undated-2' },
      { id: 'new', startDate: '2024-06-01T00:00:00Z' }
    ])

    expect(sorted.map((b) => b.id)).toEqual(['new', 'old', 'undated-1', 'undated-2'])
  })
})
