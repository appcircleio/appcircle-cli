import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import FormData from 'form-data'
import { ProgramError } from '../../../src/core/ProgramError'
import { EnvironmentVariableTypes } from '../../../src/constant'
import { getMaxUploadBytes, GB } from '../../../src/utils/size-limit'

// Mock all dependencies
vi.mock('fs')
vi.mock('path')
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
  getHeaders: vi.fn(() => ({
    'Authorization': 'Bearer test-token',
    'Content-Type': 'application/json'
  })),
  AUTH_HOSTNAME: 'https://auth.appcircle.io'
}))

vi.mock('../../../src/constant', () => ({
  CountriesList: [
    ['United States', 'US'],
    ['Turkey', 'TR'],
    ['Germany', 'DE']
  ],
  EnvironmentVariableTypes: {
    TEXT: 'TEXT',
    FILE: 'FILE'
  }
}))

// Import functions after mocking
import {
  getToken,
  getTokenFromApiKey,
  getBuildProfiles,
  getCommits,
  getBuildsOfCommit,
  getActiveBuilds,
  startBuild,
  downloadArtifact,
  downloadBuildLog,
  uploadArtifact,
  uploadArtifactWithSignedUrl,
  getEnvironmentVariableGroups,
  createEnvironmentVariableGroup,
  getEnvironmentVariables,
  uploadEnvironmentVariablesFromFile,
  createEnvironmentVariable,
  getBranches,
  getWorkflows,
  getConfigurations,
  getTaskStatus,
  getUserInfo,
  getCountries,
  getBuildStatusFromQueue,
  getBuildStatus,
  downloadTaskLog,
  getLatestBuildByBranch,
  getLatestBuildId
} from '../../../src/services/index'

import { appcircleApi, getHeaders, AUTH_HOSTNAME } from '../../../src/services/api'

const mockAppcircleApi = appcircleApi as any
const mockGetHeaders = getHeaders as any
const mockFs = vi.mocked(fs)
const mockPath = vi.mocked(path)
const MockFormData = vi.mocked(FormData)

describe('Services Index - Main Service Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    mockGetHeaders.mockReturnValue({
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json'
    })
    
    MockFormData.prototype.append = vi.fn()
    MockFormData.prototype.getHeaders = vi.fn(() => ({
      'content-type': 'multipart/form-data; boundary=test'
    }))
    MockFormData.prototype.getBoundary = vi.fn(() => 'test-boundary')
    
    vi.mocked(getMaxUploadBytes).mockReturnValue(5 * GB)
    
    // Mock path.join for downloadArtifact
    mockPath.join.mockImplementation((...paths: string[]) => paths.join('/'))
    
    // Mock console methods to suppress output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Authentication Operations', () => {
    describe('getToken', () => {
      it('should authenticate with personal access key', async () => {
        const mockTokenResponse = {
          access_token: 'abc123token',
          expires_in: 3600,
          token_type: 'Bearer'
        }
        vi.mocked(axios.post).mockResolvedValue({ data: mockTokenResponse })

        const result = await getToken({ personalAccessKey: 'personal_access_key_12345' })

        expect(axios.post).toHaveBeenCalledWith(
          `${AUTH_HOSTNAME}/auth/v3/token`,
          'personalAccessKey=personal_access_key_12345',
          {
            headers: {
              accept: 'application/json',
              'content-type': 'application/x-www-form-urlencoded'
            }
          }
        )
        expect(result).toEqual(mockTokenResponse)
      })

      it('should handle invalid PAT error', async () => {
        const authError = new Error('Invalid personal access token')
        vi.mocked(axios.post).mockRejectedValue(authError)

        await expect(getToken({ personalAccessKey: 'invalid_personal_access_key' }))
          .rejects.toThrow('Invalid personal access token')
      })

      it('should handle network timeout', async () => {
        const timeoutError = new Error('timeout')
        ;(timeoutError as any).code = 'ETIMEDOUT'
        vi.mocked(axios.post).mockRejectedValue(timeoutError)

        await expect(getToken({ personalAccessKey: 'personal_access_key_12345' }))
          .rejects.toThrow('timeout')
      })

      it('should handle malformed PAT format', async () => {
        const formatError = new Error('Malformed token')
        ;(formatError as any).response = { status: 400, data: { error: 'Invalid token format' } }
        vi.mocked(axios.post).mockRejectedValue(formatError)

        await expect(getToken({ personalAccessKey: 'malformed-personal-access-key' }))
          .rejects.toThrow('Malformed token')
      })
    })

    describe('getTokenFromApiKey', () => {
      it('should authenticate with API key without organization', async () => {
        const mockTokenResponse = { access_token: 'token123', expires_in: 3600 }
        vi.mocked(axios.post).mockResolvedValue({ data: mockTokenResponse })

        const result = await getTokenFromApiKey({
          name: 'api-key-name',
          secret: 'api-secret-123'
        })

        expect(axios.post).toHaveBeenCalledWith(
          `${AUTH_HOSTNAME}/auth/v1/api-key/token`,
          'name=api-key-name&secret=api-secret-123',
          expect.any(Object)
        )
        expect(result).toEqual(mockTokenResponse)
      })

      it('should authenticate with API key and organization', async () => {
        const mockTokenResponse = { access_token: 'token456' }
        vi.mocked(axios.post).mockResolvedValue({ data: mockTokenResponse })

        await getTokenFromApiKey({
          name: 'api-key',
          secret: 'secret',
          organizationId: 'org-123'
        })

        expect(axios.post).toHaveBeenCalledWith(
          expect.any(String),
          'name=api-key&secret=secret&organizationId=org-123',
          expect.any(Object)
        )
      })

      it('should handle 403 organization access error', async () => {
        const orgError = new Error('Forbidden')
        ;(orgError as any).response = { status: 403, data: {} }
        vi.mocked(axios.post).mockRejectedValue(orgError)

        await expect(getTokenFromApiKey({
          name: 'api-key',
          secret: 'secret',
          organizationId: 'restricted-org'
        })).rejects.toThrow(ProgramError)
        
        try {
          await getTokenFromApiKey({
            name: 'api-key',
            secret: 'secret',
            organizationId: 'restricted-org'
          })
        } catch (error) {
          expect(error.message).toContain('does not have access to organization "restricted-org"')
        }
      })

      it('should handle 400 invalid GUID error', async () => {
        const guidError = new Error('Bad Request')
        ;(guidError as any).response = {
          status: 400,
          data: { error: 'organizationId must be a valid GUID format' }
        }
        vi.mocked(axios.post).mockRejectedValue(guidError)

        await expect(getTokenFromApiKey({
          name: 'api-key',
          secret: 'secret',
          organizationId: 'invalid-guid-format'
        })).rejects.toThrow(ProgramError)
        
        try {
          await getTokenFromApiKey({
            name: 'api-key',
            secret: 'secret',
            organizationId: 'invalid-guid-format'
          })
        } catch (error) {
          expect(error.message).toContain('Invalid organization ID format')
        }
      })

      it('should handle 401 authentication failed', async () => {
        const authError = new Error('Unauthorized')
        ;(authError as any).response = { status: 401, data: {} }
        vi.mocked(axios.post).mockRejectedValue(authError)

        await expect(getTokenFromApiKey({
          name: 'wrong-key',
          secret: 'wrong-secret'
        })).rejects.toThrow(ProgramError)
        
        try {
          await getTokenFromApiKey({
            name: 'wrong-key',
            secret: 'wrong-secret'
          })
        } catch (error) {
          expect(error.message).toContain('Authentication failed: Invalid API Key credentials')
        }
      })

      it('should handle server errors (5xx)', async () => {
        const serverError = new Error('Internal Server Error')
        ;(serverError as any).response = { status: 500, data: {} }
        vi.mocked(axios.post).mockRejectedValue(serverError)

        await expect(getTokenFromApiKey({
          name: 'api-key',
          secret: 'secret'
        })).rejects.toThrow(ProgramError)
        
        try {
          await getTokenFromApiKey({
            name: 'api-key',
            secret: 'secret'
          })
        } catch (error) {
          expect(error.message).toContain('Server error occurred')
        }
      })

      it('should handle network connection errors', async () => {
        const networkError = new Error('Network Error')
        ;(networkError as any).code = 'ENOTFOUND'
        vi.mocked(axios.post).mockRejectedValue(networkError)

        await expect(getTokenFromApiKey({
          name: 'api-key',
          secret: 'secret'
        })).rejects.toThrow(ProgramError)
        
        try {
          await getTokenFromApiKey({
            name: 'api-key',
            secret: 'secret'
          })
        } catch (error) {
          expect(error.message).toContain('Connection error: Unable to connect to Appcircle servers')
        }
      })

      it('should handle ECONNRESET connection errors', async () => {
        const resetError = new Error('Connection reset')
        ;(resetError as any).code = 'ECONNRESET'
        vi.mocked(axios.post).mockRejectedValue(resetError)

        await expect(getTokenFromApiKey({
          name: 'api-key',
          secret: 'secret'
        })).rejects.toThrow(ProgramError)
        
        try {
          await getTokenFromApiKey({
            name: 'api-key',
            secret: 'secret'
          })
        } catch (error) {
          expect(error.message).toContain('Connection error: Unable to connect to Appcircle servers')
        }
      })

      it('should handle other HTTP status codes', async () => {
        const teapotError = new Error('I am a teapot')
        ;(teapotError as any).response = { status: 418, data: {} }
        vi.mocked(axios.post).mockRejectedValue(teapotError)

        // Should re-throw the original error for unhandled status codes
        await expect(getTokenFromApiKey({
          name: 'api-key',
          secret: 'secret'
        })).rejects.toThrow('I am a teapot')
      })

      it('should handle undefined organizationId parameter', async () => {
        const mockTokenResponse = { access_token: 'token789' }
        vi.mocked(axios.post).mockResolvedValue({ data: mockTokenResponse })

        await getTokenFromApiKey({
          name: 'api-key',
          secret: 'secret',
          organizationId: undefined
        })

        // Should not include organizationId in request data when undefined
        expect(axios.post).toHaveBeenCalledWith(
          expect.any(String),
          'name=api-key&secret=secret',
          expect.any(Object)
        )
      })
    })
  })

  describe('Build Management', () => {
    describe('getBuildProfiles', () => {
      it('should fetch build profiles successfully', async () => {
        const mockProfiles = [
          { id: 'profile1', name: 'iOS Profile' },
          { id: 'profile2', name: 'Android Profile' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockProfiles })

        const result = await getBuildProfiles()

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v2/profiles',
          { headers: mockGetHeaders() }
        )
        expect(result).toEqual(mockProfiles)
      })

      it('should handle empty profiles list', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })

        const result = await getBuildProfiles()
        expect(result).toEqual([])
      })

      it('should handle API errors', async () => {
        const apiError = new Error('API Error')
        mockAppcircleApi.get.mockRejectedValue(apiError)

        await expect(getBuildProfiles()).rejects.toThrow('API Error')
      })
    })

    describe('getCommits', () => {
      it('should fetch commits for branch', async () => {
        const mockCommits = [
          { id: 'commit1', hash: 'abc123', message: 'Initial commit' },
          { id: 'commit2', hash: 'def456', message: 'Feature update' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockCommits })

        const result = await getCommits({ branchId: 'branch123' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v2/commits?branchId=branch123',
          { headers: mockGetHeaders() }
        )
        expect(result).toEqual(mockCommits)
      })

      it('should handle special characters in branchId', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })

        await getCommits({ branchId: 'feature/user-auth' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v2/commits?branchId=feature/user-auth',
          expect.any(Object)
        )
      })

      it('should handle empty commits list', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })

        const result = await getCommits({ branchId: 'empty-branch' })
        expect(result).toEqual([])
      })
    })

    describe('startBuild', () => {
      beforeEach(() => {
        // Mock dependencies for startBuild
        mockAppcircleApi.get.mockImplementation((url) => {
          if (url.includes('commits?branchId=')) {
            return Promise.resolve({
              data: [
                { id: 'commit1', hash: 'abc123' },
                { id: 'commit2', hash: 'def456' }
              ]
            })
          }
          if (url.includes('configurations')) {
            return Promise.resolve({
              data: [{ item1: { id: 'config1' } }]
            })
          }
          return Promise.resolve({ data: [] })
        })
        mockAppcircleApi.post.mockResolvedValue({ data: { buildId: 'build123' } })
      })

      it('should start build with branchId (auto-detect latest commit)', async () => {
        const result = await startBuild({
          profileId: 'profile123',
          branchId: 'branch456'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v2/commits?branchId=branch456',
          expect.any(Object)
        )
        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v2/profiles/profile123/configurations',
          expect.any(Object)
        )
        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.stringContaining('build/v2/commits/commit1'),
          '{}',
          expect.any(Object)
        )
        expect(result).toEqual({ buildId: 'build123' })
      })

      it('should start build with specific commitId', async () => {
        const result = await startBuild({
          profileId: 'profile123',
          commitId: 'specific-commit'
        })

        // Should skip commit fetch when commitId is provided
        expect(mockAppcircleApi.get).not.toHaveBeenCalledWith(
          expect.stringContaining('commits?branchId='),
          expect.any(Object)
        )
        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.stringContaining('build/v2/commits/specific-commit'),
          '{}',
          expect.any(Object)
        )
        expect(result).toEqual({ buildId: 'build123' })
      })

      it('should start build with commitHash', async () => {
        await startBuild({
          profileId: 'profile123',
          branchId: 'branch456',
          commitHash: 'abc123'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v2/commits?branchId=branch456',
          expect.any(Object)
        )
        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.stringContaining('build/v2/commits/commit1'), // Found by hash
          '{}',
          expect.any(Object)
        )
      })

      it('should throw error when branchId missing and no commitId', async () => {
        await expect(startBuild({
          profileId: 'profile123'
          // Missing both branchId and commitId
        })).rejects.toThrow(ProgramError)
        
        try {
          await startBuild({
            profileId: 'profile123'
          })
        } catch (error) {
          expect(error.message).toContain('Branch ID is required when commit ID is not provided')
        }
      })

      it('should throw error when no commits found for branch', async () => {
        mockAppcircleApi.get.mockImplementation((url) => {
          if (url.includes('commits?branchId=empty-branch')) {
            return Promise.resolve({ data: [] })
          }
          return Promise.resolve({ data: [{ item1: { id: 'config1' } }] })
        })

        await expect(startBuild({
          profileId: 'profile123',
          branchId: 'empty-branch'
        })).rejects.toThrow(ProgramError)
        
        try {
          await startBuild({
            profileId: 'profile123',
            branchId: 'empty-branch'
          })
        } catch (error) {
          expect(error.message).toContain('No commits found for branch ID "empty-branch"')
        }
      })

      it('should throw error when commit hash not found', async () => {
        await expect(startBuild({
          profileId: 'profile123',
          branchId: 'branch456',
          commitHash: 'nonexistent-hash'
        })).rejects.toThrow(ProgramError)
        
        try {
          await startBuild({
            profileId: 'profile123',
            branchId: 'branch456',
            commitHash: 'nonexistent-hash'
          })
        } catch (error) {
          expect(error.message).toContain('Commit with hash "nonexistent-hash" not found')
        }
      })

      it('should throw error when no configurations found', async () => {
        mockAppcircleApi.get.mockImplementation((url) => {
          if (url.includes('commits?branchId=')) {
            return Promise.resolve({ data: [{ id: 'commit1', hash: 'abc123' }] })
          }
          if (url.includes('configurations')) {
            return Promise.resolve({ data: [] })
          }
          return Promise.resolve({ data: [] })
        })

        await expect(startBuild({
          profileId: 'profile123',
          commitId: 'commit1'
        })).rejects.toThrow(ProgramError)
        
        try {
          await startBuild({
            profileId: 'profile123',
            commitId: 'commit1'
          })
        } catch (error) {
          expect(error.message).toContain('No configurations found for profile ID "profile123"')
        }
      })

      it('should use provided workflowId and configurationId', async () => {
        await startBuild({
          profileId: 'profile123',
          commitId: 'commit1',
          workflowId: 'workflow456',
          configurationId: 'config789'
        })

        // Should skip configuration fetch when configurationId is provided
        expect(mockAppcircleApi.get).not.toHaveBeenCalledWith(
          expect.stringContaining('configurations'),
          expect.any(Object)
        )
        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.stringContaining('workflowId=workflow456'),
          '{}',
          expect.any(Object)
        )
        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.stringContaining('configurationId=config789'),
          '{}',
          expect.any(Object)
        )
      })

      it('should handle null/undefined configurations', async () => {
        mockAppcircleApi.get.mockImplementation((url) => {
          if (url.includes('commits?branchId=')) {
            return Promise.resolve({ data: [{ id: 'commit1', hash: 'abc123' }] })
          }
          if (url.includes('configurations')) {
            return Promise.resolve({ data: [{ item1: null }] })
          }
          return Promise.resolve({ data: [] })
        })

        await expect(startBuild({
          profileId: 'profile123',
          branchId: 'branch456'
        })).rejects.toThrow(ProgramError)
      })

      it('should handle malformed configuration response', async () => {
        mockAppcircleApi.get.mockImplementation((url) => {
          if (url.includes('commits?branchId=')) {
            return Promise.resolve({ data: [{ id: 'commit1', hash: 'abc123' }] })
          }
          if (url.includes('configurations')) {
            return Promise.resolve({ data: [{ item1: { /* missing id */ } }] })
          }
          return Promise.resolve({ data: [] })
        })

        await expect(startBuild({
          profileId: 'profile123',
          branchId: 'branch456'
        })).rejects.toThrow(ProgramError)
      })
    })

    describe('getLatestBuildId', () => {
      it('should return latest build ID sorted by startDate', async () => {
        const mockBuilds = [
          { id: 'build1', startDate: '2024-01-01T10:00:00Z' },
          { id: 'build2', startDate: '2024-01-02T10:00:00Z' }, // Latest
          { id: 'build3', startDate: '2024-01-01T15:00:00Z' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockBuilds })

        const result = await getLatestBuildId({
          branchId: 'branch123',
          profileId: 'profile456'
        })

        expect(result).toBe('build2')
        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/builds?branchId=branch123&profileId=profile456',
          expect.any(Object)
        )
      })

      it('should return null when no builds exist', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })

        const result = await getLatestBuildId({
          branchId: 'branch123',
          profileId: 'profile456'
        })

        expect(result).toBeNull()
      })

      it('should handle API errors gracefully', async () => {
        mockAppcircleApi.get.mockRejectedValue(new Error('API Error'))

        const result = await getLatestBuildId({
          branchId: 'branch123',
          profileId: 'profile456'
        })

        expect(result).toBeNull()
        expect(console.error).toHaveBeenCalledWith('Error getting latest build ID:', expect.any(Error))
      })

      it('should handle null response data', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: null })

        const result = await getLatestBuildId({
          branchId: 'branch123',
          profileId: 'profile456'
        })

        expect(result).toBeNull()
      })

      it('should handle missing startDate in builds', async () => {
        const mockBuilds = [
          { id: 'build1' }, // Missing startDate
          { id: 'build2', startDate: '2024-01-02T10:00:00Z' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockBuilds })

        const result = await getLatestBuildId({
          branchId: 'branch123',
          profileId: 'profile456'
        })

        // Should handle the sort gracefully and return first valid build
        expect(result).toBeDefined()
      })
    })

    describe('getActiveBuilds', () => {
      it('should fetch active builds from queue', async () => {
        const mockActiveBuilds = [
          { id: 'build1', status: 'running' },
          { id: 'build2', status: 'queued' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockActiveBuilds })

        const result = await getActiveBuilds()

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          '/build/v1/queue/my-dashboard?page=1&size=1000',
          { headers: mockGetHeaders() }
        )
        expect(result).toEqual(mockActiveBuilds)
      })

      it('should handle large build queues', async () => {
        const largeBuildList = Array(1000).fill(0).map((_, i) => ({
          id: `build${i}`,
          status: 'queued'
        }))
        mockAppcircleApi.get.mockResolvedValue({ data: largeBuildList })

        const result = await getActiveBuilds()
        expect(result).toHaveLength(1000)
      })
    })
  })

  describe('File Download Operations', () => {
    describe('downloadArtifact', () => {
      beforeEach(() => {
        mockFs.mkdirSync.mockImplementation(() => '')
        mockFs.writeFileSync.mockImplementation(() => {})
        
        // Mock getLatestBuildId function
        mockAppcircleApi.get.mockImplementation((url: string) => {
          if (url.includes('build/v1/builds?branchId=')) {
            return Promise.resolve({
              data: [{ id: 'latest-build-123', startDate: '2024-01-02T10:00:00Z' }]
            })
          }
          if (url.includes('commits/') && url.includes('/builds/')) {
            return Promise.resolve({
              status: 200,
              data: Buffer.from('artifact content')
            })
          }
          if (url.includes('build/v2/commits/')) {
            return Promise.resolve({
              data: {
                builds: [{ id: 'build-from-commit' }]
              }
            })
          }
          return Promise.resolve({ data: [] })
        })
      })

      it('should download artifact using provided buildId', async () => {
        mockAppcircleApi.get.mockResolvedValue({
          status: 200,
          data: Buffer.from('artifact content')
        })

        await downloadArtifact({
          commitId: 'commit123',
          buildId: 'specific-build-id'
        }, '/download/path', 'custom-artifact.zip')

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/commits/commit123/builds/specific-build-id',
          expect.objectContaining({ responseType: 'arraybuffer' })
        )
        expect(mockFs.mkdirSync).toHaveBeenCalledWith('/download/path', { recursive: true })
        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          expect.stringContaining('custom-artifact.zip'),
          expect.any(Buffer)
        )
      })

      it('should use latest build ID when branchId and profileId provided', async () => {
        mockAppcircleApi.get.mockImplementation((url: string) => {
          if (url.includes('build/v1/builds?branchId=branch456')) {
            return Promise.resolve({
              data: [{ id: 'latest-build-456', startDate: '2024-01-02T10:00:00Z' }]
            })
          }
          if (url.includes('commits/commit123/builds/latest-build-456')) {
            return Promise.resolve({
              status: 200,
              data: Buffer.from('content')
            })
          }
          return Promise.resolve({ data: [] })
        })

        await downloadArtifact({
          commitId: 'commit123',
          branchId: 'branch456',
          profileId: 'profile789'
        }, '/download')

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/builds?branchId=branch456&profileId=profile789',
          expect.any(Object)
        )
        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/commits/commit123/builds/latest-build-456',
          expect.any(Object)
        )
      })

      it('should fallback to build from commit when no buildId', async () => {
        mockAppcircleApi.get.mockImplementation((url: string) => {
          if (url.includes('build/v2/commits/commit123')) {
            return Promise.resolve({
              data: {
                builds: [{ id: 'build-from-commit' }]
              }
            })
          }
          if (url.includes('commits/commit123/builds/build-from-commit')) {
            return Promise.resolve({
              status: 200,
              data: Buffer.from('content')
            })
          }
          return Promise.resolve({ data: [] })
        })

        await downloadArtifact({
          commitId: 'commit123'
          // No buildId, branchId, or profileId
        }, '/download')

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v2/commits/commit123',
          expect.any(Object)
        )
        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/commits/commit123/builds/build-from-commit',
          expect.any(Object)
        )
      })

      it('should handle empty GUID buildId', async () => {
        mockAppcircleApi.get.mockImplementation((url: string) => {
          if (url.includes('build/v2/commits/commit123') && !url.includes('/builds/')) {
            return Promise.resolve({
              data: {
                builds: [{ id: 'build-from-commit' }]
              }
            })
          }
          return Promise.resolve({
            status: 200,
            data: Buffer.from('content')
          })
        })

        await downloadArtifact({
          commitId: 'commit123',
          buildId: '00000000-0000-0000-0000-000000000000'
        }, '/download')

        // Should treat empty GUID as no buildId
        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v2/commits/commit123',
          expect.any(Object)
        )
      })

      it('should generate filename with timestamp when not provided', async () => {
        const mockNow = 1640995200000 // 2022-01-01T00:00:00.000Z
        vi.spyOn(Date, 'now').mockReturnValue(mockNow)
        
        mockAppcircleApi.get.mockResolvedValue({
          status: 200,
          data: Buffer.from('content')
        })

        await downloadArtifact({
          commitId: 'commit123',
          buildId: 'build123'
        }, '/download')

        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          expect.stringContaining('artifacts-1640995200000.zip'),
          expect.any(Buffer)
        )
      })

      it('should handle 404 not found error', async () => {
        const notFoundError = new Error('Not Found')
        ;(notFoundError as any).response = { status: 404 }
        mockAppcircleApi.get.mockRejectedValue(notFoundError)

        await expect(downloadArtifact({
          commitId: 'commit123',
          buildId: 'nonexistent-build'
        }, '/download')).rejects.toThrow(/Build artifact not found.*nonexistent-build/)
      })

      it('should handle non-200 response status', async () => {
        mockAppcircleApi.get.mockResolvedValue({
          status: 500,
          data: 'Error response'
        })

        await expect(downloadArtifact({
          commitId: 'commit123',
          buildId: 'build123'
        }, '/download')).rejects.toThrow('Build artifact not found')
      })

      it('should handle no builds found for commit', async () => {
        mockAppcircleApi.get.mockImplementation((url: string) => {
          if (url.includes('build/v2/commits/commit123') && !url.includes('/builds/')) {
            return Promise.resolve({ data: { builds: [] } })
          }
          return Promise.resolve({ data: [] })
        })

        await expect(downloadArtifact({
          commitId: 'commit123'
        }, '/download')).rejects.toThrow('No builds found for commit ID: commit123')
      })

      it('should handle null builds response', async () => {
        mockAppcircleApi.get.mockImplementation((url: string) => {
          if (url.includes('build/v2/commits/commit123') && !url.includes('/builds/')) {
            return Promise.resolve({ data: { builds: null } })
          }
          return Promise.resolve({ data: [] })
        })

        await expect(downloadArtifact({
          commitId: 'commit123'
        }, '/download')).rejects.toThrow('No builds found for commit ID: commit123')
      })
    })

    describe('downloadBuildLog', () => {
      beforeEach(() => {
        mockFs.createWriteStream.mockReturnValue({
          write: vi.fn(),
          end: vi.fn(),
          on: vi.fn()
        } as any)
        
        mockAppcircleApi.get.mockImplementation((url: string) => {
          if (url.includes('build/v1/builds?branchId=')) {
            return Promise.resolve({
              data: [{ id: 'latest-build-456', startDate: '2024-01-02T10:00:00Z' }]
            })
          }
          if (url.includes('build/v2/commits/')) {
            return Promise.resolve({
              data: {
                builds: [{ id: 'commit-build-789' }]
              }
            })
          }
          if (url.includes('/logs')) {
            return Promise.resolve({
              data: 'Build log content here'
            })
          }
          return Promise.resolve({ data: [] })
        })
      })

      it('should download build log with specific buildId', async () => {
        mockAppcircleApi.get.mockResolvedValue({
          data: 'Build log content here'
        })

        const mockWriter = {
          write: vi.fn(),
          end: vi.fn(),
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'finish') callback()
            return mockWriter
          })
        }
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        await downloadBuildLog({
          commitId: 'commit123',
          buildId: 'specific-build'
        }, '/logs', 'custom-log.txt')

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/commits/commit123/builds/specific-build/logs',
          expect.objectContaining({ responseType: 'text' })
        )
        expect(mockWriter.write).toHaveBeenCalledWith('Build log content here')
      })

      it('should handle "No Logs Available" response', async () => {
        mockAppcircleApi.get.mockResolvedValue({
          data: 'No Logs Available'
        })

        await expect(downloadBuildLog({
          commitId: 'commit123',
          buildId: 'build123'
        }, '/logs')).rejects.toThrow('No Logs Available')
      })

      it('should handle empty log response', async () => {
        mockAppcircleApi.get.mockResolvedValue({
          data: '   '  // Whitespace only
        })

        await expect(downloadBuildLog({
          commitId: 'commit123',
          buildId: 'build123'
        }, '/logs')).rejects.toThrow('Empty response')
      })

      it('should use latest build when branchId and profileId provided', async () => {
        mockAppcircleApi.get.mockImplementation((url: string) => {
          if (url.includes('build/v1/builds?branchId=branch456')) {
            return Promise.resolve({
              data: [{ id: 'latest-build-456', startDate: '2024-01-02T10:00:00Z' }]
            })
          }
          return Promise.resolve({
            data: 'Log content'
          })
        })
        
        const mockWriter = {
          write: vi.fn(),
          end: vi.fn(),
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'finish') callback()
            return mockWriter
          })
        }
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        await downloadBuildLog({
          commitId: 'commit123',
          branchId: 'branch456',
          profileId: 'profile789'
        }, '/logs')

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/builds?branchId=branch456&profileId=profile789',
          expect.any(Object)
        )
        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/commits/commit123/builds/latest-build-456/logs',
          expect.any(Object)
        )
      })

      it('should handle file write errors', async () => {
        mockAppcircleApi.get.mockResolvedValue({
          data: 'Log content'
        })

        const writeError = new Error('ENOSPC: no space left on device')
        const mockWriter = {
          write: vi.fn(),
          end: vi.fn(),
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'error') callback(writeError)
            return mockWriter
          })
        }
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        await expect(downloadBuildLog({
          commitId: 'commit123',
          buildId: 'build123'
        }, '/logs')).rejects.toThrow('ENOSPC')
      })

      it('should continue with existing buildId when API fails', async () => {
        // Mock getLatestBuildId to return null (failure case)
        mockAppcircleApi.get.mockImplementation((url: string) => {
          if (url.includes('build/v1/builds?branchId=branch456')) {
            return Promise.resolve({ data: [] }) // Empty array means no builds found
          }
          if (url.includes('/logs')) {
            return Promise.resolve({
              data: 'Log content'
            })
          }
          return Promise.resolve({ data: [] })
        })

        const mockWriter = {
          write: vi.fn(),
          end: vi.fn(),
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'finish') callback()
            return mockWriter
          })
        }
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        await downloadBuildLog({
          commitId: 'commit123',
          buildId: 'existing-build',
          branchId: 'branch456',
          profileId: 'profile789'
        }, '/logs')

        // Should log the attempt and fallback message
        expect(console.log).toHaveBeenCalledWith('Getting latest build ID with Branch and Profile ID...')
        expect(console.log).toHaveBeenCalledWith('Could not get build ID from API, trying alternative method.')
      })

      it('should handle 404 log not found', async () => {
        const notFoundError = new Error('Not Found')
        ;(notFoundError as any).response = { status: 404 }
        mockAppcircleApi.get.mockRejectedValue(notFoundError)

        await expect(downloadBuildLog({
          commitId: 'commit123',
          buildId: 'build123'
        }, '/logs')).rejects.toThrow('No Logs Available (404)')
      })

      it('should handle other HTTP errors', async () => {
        const httpError = new Error('Internal Server Error')
        ;(httpError as any).response = { status: 500 }
        mockAppcircleApi.get.mockRejectedValue(httpError)

        await expect(downloadBuildLog({
          commitId: 'commit123',
          buildId: 'build123'
        }, '/logs')).rejects.toThrow('HTTP error: 500')
      })

      it('should throw error when buildId cannot be determined and no existing buildId', async () => {
        // Test the case where we don't provide buildId AND there are no branchId/profileId
        // This should trigger the !buildId condition and try to get builds from commit
        mockAppcircleApi.get.mockImplementation((url: string) => {
          if (url.includes('build/v2/commits/commit123') && !url.includes('/builds/')) {
            return Promise.resolve({ data: { builds: [] } }) // No builds in commit
          }
          return Promise.resolve({ data: [] })
        })

        await expect(downloadBuildLog({
          commitId: 'commit123'
          // No buildId, no branchId, no profileId - should fallback to getBuildsOfCommit
        }, '/logs')).rejects.toThrow('No builds found for commit ID: commit123')
      })
    })
  })

  describe('Environment Variable Operations', () => {
    describe('createEnvironmentVariable', () => {
      it('should create TEXT environment variable', async () => {
        const mockResponse = { id: 'var123', key: 'TEST_VAR', value: 'test-value' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await createEnvironmentVariable({
          type: EnvironmentVariableTypes.TEXT as any,
          variableGroupId: 'group123',
          key: 'TEST_VAR',
          value: 'test-value',
          isSecret: false,
          filePath: ''
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'build/v1/variable-groups/group123/variables',
          { Key: 'TEST_VAR', Value: 'test-value', IsSecret: 'false' },
          { headers: mockGetHeaders() }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should create FILE environment variable', async () => {
        const mockResponse = { id: 'var456', key: 'TEST_FILE' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })
        mockPath.basename.mockReturnValue('test.txt')
        mockFs.createReadStream.mockReturnValue({ path: '/tmp/test.txt' } as any)

        const result = await createEnvironmentVariable({
          type: EnvironmentVariableTypes.FILE as any,
          variableGroupId: 'group123',
          key: 'TEST_FILE',
          value: '',
          filePath: '/tmp/test.txt',
          isSecret: false
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'build/v1/variable-groups/group123/variables/files',
          expect.any(MockFormData),
          expect.objectContaining({
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should validate required key parameter', async () => {
        await expect(createEnvironmentVariable({
          type: EnvironmentVariableTypes.TEXT as any,
          variableGroupId: 'group123',
          key: '',
          value: 'test-value',
          isSecret: false,
          filePath: ''
        })).rejects.toThrow('Environment variable key is required')
      })

      it('should validate FILE type requires filePath', async () => {
        await expect(createEnvironmentVariable({
          type: EnvironmentVariableTypes.FILE as any,
          variableGroupId: 'group123',
          key: 'TEST_FILE',
          value: '',
          filePath: '',
          isSecret: false
        })).rejects.toThrow('File path is required for FILE type environment variables')
      })

      it('should validate TEXT type requires value', async () => {
        await expect(createEnvironmentVariable({
          type: EnvironmentVariableTypes.TEXT as any,
          variableGroupId: 'group123',
          key: 'TEST_VAR',
          value: undefined as any,
          isSecret: false,
          filePath: ''
        })).rejects.toThrow('Value is required for TEXT type environment variables')
      })

      it('should handle unknown environment variable type', async () => {
        await expect(createEnvironmentVariable({
          type: 'UNKNOWN' as any,
          variableGroupId: 'group123',
          key: 'TEST_VAR',
          value: 'test-value',
          isSecret: false,
          filePath: ''
        })).rejects.toThrow('Environment variable type (UNKNOWN) not found')
      })
    })

    describe('uploadEnvironmentVariablesFromFile', () => {
      it('should upload environment variables from file', async () => {
        const mockResponse = { message: 'Variables uploaded successfully' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })
        mockFs.createReadStream.mockReturnValue({ path: '/tmp/env.json' } as any)

        const result = await uploadEnvironmentVariablesFromFile({
          variableGroupId: 'group123',
          filePath: '/tmp/env.json'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'build/v1/variable-groups/group123/upload-variables-file',
          expect.any(MockFormData),
          expect.objectContaining({
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle upload errors', async () => {
        const uploadError = new Error('Upload failed')
        mockAppcircleApi.post.mockRejectedValue(uploadError)
        mockFs.createReadStream.mockReturnValue({ path: '/tmp/env.json' } as any)

        await expect(uploadEnvironmentVariablesFromFile({
          variableGroupId: 'group123',
          filePath: '/tmp/env.json'
        })).rejects.toThrow('Upload failed')
      })
    })
  })

  describe('Additional Service Functions', () => {
    describe('uploadArtifactWithSignedUrl', () => {
      beforeEach(() => {
        mockFs.statSync.mockReturnValue({ size: 1024 * 1024 } as any) // 1MB file
        vi.mocked(getMaxUploadBytes).mockReturnValue(5 * 1024 * 1024 * 1024) // 5GB limit
      })

      it('should upload with PUT method when no configuration provided', async () => {
        const uploadInfo = {
          uploadUrl: 'https://example.com/upload',
          fileId: 'file123',
          configuration: null as any
        }
        const mockStream = { path: '/app/test.ipa' }
        mockFs.createReadStream.mockReturnValue(mockStream as any)
        vi.mocked(axios.put).mockResolvedValue({ data: 'success' })

        await uploadArtifactWithSignedUrl({
          app: '/app/test.ipa',
          uploadInfo
        })

        expect(axios.put).toHaveBeenCalledWith(
          'https://example.com/upload',
          mockStream,
          expect.objectContaining({
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
              'Content-Length': 1024 * 1024,
              'Content-Type': 'application/octet-stream'
            }
          })
        )
      })

      it('should upload with POST method when configured', async () => {
        const uploadInfo = {
          uploadUrl: 'https://example.com/upload',
          fileId: 'file456',
          configuration: {
            httpMethod: 'POST' as any,
            signParameters: {
              'key': 'value',
              'policy': 'encoded-policy'
            }
          }
        }
        const mockStream = { path: '/app/test.ipa' }
        mockFs.createReadStream.mockReturnValue(mockStream as any)
        vi.mocked(axios.post).mockResolvedValue({ data: 'success' })

        await uploadArtifactWithSignedUrl({
          app: '/app/test.ipa',
          uploadInfo
        })

        expect(axios.post).toHaveBeenCalledWith(
          'https://example.com/upload',
          expect.any(MockFormData),
          expect.objectContaining({
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          })
        )
        expect(MockFormData.prototype.append).toHaveBeenCalledWith('key', 'value')
        expect(MockFormData.prototype.append).toHaveBeenCalledWith('policy', 'encoded-policy')
        expect(MockFormData.prototype.append).toHaveBeenCalledWith('file', mockStream)
      })

      it('should validate upload information', async () => {
        await expect(uploadArtifactWithSignedUrl({
          app: '/app/test.ipa',
          uploadInfo: null as any
        })).rejects.toThrow('Upload information is required')

        await expect(uploadArtifactWithSignedUrl({
          app: '/app/test.ipa',
          uploadInfo: { uploadUrl: null, fileId: 'file123', configuration: null } as any
        })).rejects.toThrow('Upload URL is missing from upload information')
      })

      it('should validate file size limits', async () => {
        mockFs.statSync.mockReturnValue({ size: 10 * 1024 * 1024 * 1024 } as any) // 10GB file
        vi.mocked(getMaxUploadBytes).mockReturnValue(5 * 1024 * 1024 * 1024) // 5GB limit

        await expect(uploadArtifactWithSignedUrl({
          app: '/app/large-file.ipa',
          uploadInfo: {
            uploadUrl: 'https://example.com/upload',
            fileId: 'large-file',
            configuration: null as any
          }
        })).rejects.toThrow('File size 10.00 GB exceeds the allowed limit of 5.00 GB')
      })

      it('should handle no size limit', async () => {
        mockFs.statSync.mockReturnValue({ size: 10 * 1024 * 1024 * 1024 } as any) // 10GB file
        vi.mocked(getMaxUploadBytes).mockReturnValue(null) // No limit
        const mockStream = { path: '/app/test.ipa' }
        mockFs.createReadStream.mockReturnValue(mockStream as any)
        vi.mocked(axios.put).mockResolvedValue({ data: 'success' })

        await uploadArtifactWithSignedUrl({
          app: '/app/large-file.ipa',
          uploadInfo: {
            uploadUrl: 'https://example.com/upload',
            fileId: 'large-file',
            configuration: null as any
          }
        })

        expect(axios.put).toHaveBeenCalled()
      })

      it('should handle PUT method explicitly specified', async () => {
        const uploadInfo = {
          uploadUrl: 'https://example.com/upload',
          fileId: 'file789',
          configuration: { httpMethod: 'PUT' as any }
        }
        const mockStream = { path: '/app/test.ipa' }
        mockFs.createReadStream.mockReturnValue(mockStream as any)
        vi.mocked(axios.put).mockResolvedValue({ data: 'success' })

        await uploadArtifactWithSignedUrl({
          app: '/app/test.ipa',
          uploadInfo
        })

        expect(axios.put).toHaveBeenCalledWith(
          'https://example.com/upload',
          mockStream,
          expect.any(Object)
        )
      })
    })

    describe('uploadArtifact', () => {
      it('should upload artifact successfully', async () => {
        // Mock file system to validate file exists
        mockFs.statSync.mockReturnValue({ isFile: () => true, size: 1024 } as any)
        const mockFormData = new MockFormData()
        const mockStream = { path: '/app/test.ipa' }
        mockFs.createReadStream.mockReturnValue(mockStream as any)
        
        const mockUploadResponse = {
          id: 'upload123',
          url: 'download-url'
        }
        mockAppcircleApi.post.mockResolvedValue({ data: mockUploadResponse })
        
        const result = await uploadArtifact({
          message: 'Test upload',
          app: '/app/test.ipa',
          distProfileId: 'dist123'
        })
        
        expect(mockFs.statSync).toHaveBeenCalledWith('/app/test.ipa')
        expect(mockFormData.append).toHaveBeenCalledWith('Message', 'Test upload')
        expect(mockFormData.append).toHaveBeenCalledWith('File', mockStream)
        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'distribution/v2/profiles/dist123/app-versions',
          expect.any(MockFormData),
          expect.objectContaining({
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          })
        )
        expect(result).toEqual(mockUploadResponse)
      })

      it('should handle upload errors', async () => {
        // Mock file validation to pass, but then make API call fail
        mockFs.statSync.mockReturnValue({ isFile: () => true, size: 1024 } as any)
        mockFs.createReadStream.mockReturnValue({} as any)
        const uploadError = new Error('Upload failed')
        mockAppcircleApi.post.mockRejectedValue(uploadError)

        await expect(uploadArtifact({
          message: 'Test upload',
          app: '/app/test.ipa',
          distProfileId: 'dist123'
        })).rejects.toThrow('Upload failed')
      })

      it('should handle large files', async () => {
        // Mock file validation to pass
        mockFs.statSync.mockReturnValue({ isFile: () => true, size: 1024 } as any)
        const mockStream = { path: '/app/large-app.ipa' }
        mockFs.createReadStream.mockReturnValue(mockStream as any)
        mockAppcircleApi.post.mockResolvedValue({ data: { id: 'upload456' } })

        await uploadArtifact({
          message: 'Large file upload',
          app: '/app/large-app.ipa', 
          distProfileId: 'dist456'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(MockFormData),
          expect.objectContaining({
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          })
        )
      })
    })

    describe('getUserInfo', () => {
      it('should fetch user information', async () => {
        const mockUserInfo = {
          sub: 'user123',
          email: 'user@example.com',
          name: 'Test User'
        }
        vi.mocked(axios.get).mockResolvedValue({ data: mockUserInfo })

        const result = await getUserInfo()

        expect(axios.get).toHaveBeenCalledWith(
          `${AUTH_HOSTNAME}/auth/realms/appcircle/protocol/openid-connect/userinfo`,
          { headers: mockGetHeaders() }
        )
        expect(result).toEqual(mockUserInfo)
      })

      it('should handle authentication errors', async () => {
        const authError = new Error('Unauthorized')
        vi.mocked(axios.get).mockRejectedValue(authError)

        await expect(getUserInfo()).rejects.toThrow('Unauthorized')
      })

      it('should handle network timeouts', async () => {
        const timeoutError = new Error('timeout')
        ;(timeoutError as any).code = 'ETIMEDOUT'
        vi.mocked(axios.get).mockRejectedValue(timeoutError)

        await expect(getUserInfo()).rejects.toThrow('timeout')
      })
    })

    describe('getCountries', () => {
      it('should return formatted countries list', () => {
        const result = getCountries()

        expect(result).toEqual([
          { alpha2: 'US', name: 'United States' },
          { alpha2: 'TR', name: 'Turkey' },
          { alpha2: 'DE', name: 'Germany' }
        ])
      })

      it('should handle empty countries list', () => {
        // Mock empty countries list
        vi.doMock('../../../src/constant', () => ({
          CountriesList: []
        }))
        
        const result = getCountries()
        expect(Array.isArray(result)).toBe(true)
      })

      it('should transform country data correctly', () => {
        const countries = getCountries()
        
        countries.forEach(country => {
          expect(country).toHaveProperty('alpha2')
          expect(country).toHaveProperty('name')
          expect(typeof country.alpha2).toBe('string')
          expect(typeof country.name).toBe('string')
        })
      })
    })

    describe('getTaskStatus', () => {
      it('should fetch task status', async () => {
        const mockTaskStatus = {
          id: 'task123',
          status: 'completed',
          progress: 100
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockTaskStatus })

        const result = await getTaskStatus({ taskId: 'task123' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'task/v1/tasks/task123',
          { headers: mockGetHeaders() }
        )
        expect(result).toEqual(mockTaskStatus)
      })

      it('should handle task not found', async () => {
        const notFoundError = new Error('Task not found')
        ;(notFoundError as any).response = { status: 404 }
        mockAppcircleApi.get.mockRejectedValue(notFoundError)

        await expect(getTaskStatus({ taskId: 'nonexistent' }))
          .rejects.toThrow('Task not found')
      })

      it('should handle various task statuses', async () => {
        const statuses = ['pending', 'running', 'completed', 'failed']
        
        for (const status of statuses) {
          mockAppcircleApi.get.mockResolvedValue({ 
            data: { id: 'task123', status }
          })
          
          const result = await getTaskStatus({ taskId: 'task123' })
          expect(result.status).toBe(status)
        }
      })
    })

    describe('getBuildStatusFromQueue', () => {
      it('should fetch build status from queue', async () => {
        const mockQueueStatus = {
          taskId: 'task123',
          buildId: 'build456',
          status: 'queued'
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockQueueStatus })

        const result = await getBuildStatusFromQueue({ taskId: 'task123' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/queue/task123',
          { headers: mockGetHeaders() }
        )
        expect(result).toEqual(mockQueueStatus)
      })

      it('should handle queue not found', async () => {
        mockAppcircleApi.get.mockRejectedValue(new Error('Queue item not found'))

        await expect(getBuildStatusFromQueue({ taskId: 'missing' }))
          .rejects.toThrow('Queue item not found')
      })
    })

    describe('getBuildStatus', () => {
      it('should fetch build status', async () => {
        const mockBuildStatus = {
          commitId: 'commit123',
          buildId: 'build456',
          status: 'success'
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockBuildStatus })

        const result = await getBuildStatus({ 
          commitId: 'commit123', 
          buildId: 'build456' 
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v2/commits/commit123/builds/build456/status',
          { headers: mockGetHeaders() }
        )
        expect(result).toEqual(mockBuildStatus)
      })

      it('should handle build status not found', async () => {
        mockAppcircleApi.get.mockRejectedValue(new Error('Build status not found'))

        await expect(getBuildStatus({ 
          commitId: 'commit123', 
          buildId: 'build456' 
        })).rejects.toThrow('Build status not found')
      })
    })

    describe('downloadTaskLog', () => {
      it('should download task log as stream', async () => {
        const mockStream = {
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'data') {
              callback(Buffer.from('Log line 1\nLog line 2\n'))
            } else if (event === 'end') {
              setTimeout(callback, 0)
            }
            return mockStream
          })
        }
        
        const mockWriter = {
          write: vi.fn(),
          end: vi.fn(),
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'finish') setTimeout(callback, 0)
            return mockWriter
          })
        }
        
        mockAppcircleApi.get.mockResolvedValue({
          status: 200,
          data: mockStream,
          headers: { 'content-type': 'text/plain' }
        })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        const result = await downloadTaskLog({ taskId: 'task123' }, '/logs')

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/queue/logs/task123',
          expect.objectContaining({ responseType: 'stream' })
        )
        expect(result).toBe(true)
      })

      it('should handle "No Logs Available" in stream', async () => {
        const mockStream = {
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'data') {
              callback(Buffer.from('No Logs Available'))
            } else if (event === 'end') {
              setTimeout(callback, 0)
            }
            return mockStream
          })
        }
        
        mockAppcircleApi.get.mockResolvedValue({
          status: 200,
          data: mockStream,
          headers: { 'content-type': 'text/plain' }
        })

        await expect(downloadTaskLog({ taskId: 'task123' }, '/logs'))
          .rejects.toThrow('No Logs Available')
      })

      it('should handle empty log response in stream', async () => {
        const mockStream = {
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'data') {
              callback(Buffer.from('   '))
            } else if (event === 'end') {
              setTimeout(callback, 0)
            }
            return mockStream
          })
        }
        
        mockAppcircleApi.get.mockResolvedValue({
          status: 200,
          data: mockStream,
          headers: { 'content-type': 'text/plain' }
        })

        await expect(downloadTaskLog({ taskId: 'task123' }, '/logs'))
          .rejects.toThrow('Empty response')
      })

      it('should handle non-text response types', async () => {
        const mockStream = {
          pipe: vi.fn().mockReturnValue({
            on: vi.fn().mockImplementation((event: string, callback: Function) => {
              if (event === 'close') setTimeout(callback, 0)
              return mockStream
            })
          })
        }
        
        const mockWriter = {
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'close') setTimeout(callback, 0)
            return mockWriter
          }),
          close: vi.fn()
        }
        
        mockAppcircleApi.get.mockResolvedValue({
          status: 200,
          data: mockStream,
          headers: { 'content-type': 'application/octet-stream' }
        })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        const result = await downloadTaskLog({ taskId: 'task123' }, '/logs')

        expect(mockStream.pipe).toHaveBeenCalledWith(mockWriter)
        expect(result).toBe(true)
      })

      it('should handle write errors in stream', async () => {
        const writeError = new Error('Write failed')
        const mockStream = {
          on: vi.fn(),
          pipe: vi.fn().mockReturnValue({
            on: vi.fn().mockImplementation((event: string, callback: Function) => {
              if (event === 'close') setTimeout(callback, 0)
              return mockStream
            })
          })
        }
        
        const mockWriter = {
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'error') {
              setTimeout(() => callback(writeError), 0)
            }
            return mockWriter
          }),
          close: vi.fn()
        }
        
        mockAppcircleApi.get.mockResolvedValue({
          status: 200,
          data: mockStream,
          headers: { 'content-type': 'application/octet-stream' }
        })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        await expect(downloadTaskLog({ taskId: 'task123' }, '/logs'))
          .rejects.toThrow('Write failed')
      })

      it('should handle 404 not found', async () => {
        const notFoundError = new Error('Not Found')
        ;(notFoundError as any).response = { status: 404 }
        mockAppcircleApi.get.mockRejectedValue(notFoundError)

        await expect(downloadTaskLog({ taskId: 'task123' }, '/logs'))
          .rejects.toThrow('No Logs Available (404)')
      })

      it('should handle other HTTP errors', async () => {
        const httpError = new Error('Internal Server Error')
        ;(httpError as any).response = { status: 500 }
        mockAppcircleApi.get.mockRejectedValue(httpError)

        await expect(downloadTaskLog({ taskId: 'task123' }, '/logs'))
          .rejects.toThrow('HTTP error: 500')
      })

      it('should handle network errors', async () => {
        const networkError = new Error('Network Error')
        mockAppcircleApi.get.mockRejectedValue(networkError)

        await expect(downloadTaskLog({ taskId: 'task123' }, '/logs'))
          .rejects.toThrow('Network Error')
      })
    })

    describe('getLatestBuildByBranch', () => {
      it('should return latest build by branch', async () => {
        const mockBuilds = [
          { id: 'build1', startDate: '2024-01-02T10:00:00Z' },
          { id: 'build2', startDate: '2024-01-01T10:00:00Z' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockBuilds })

        const result = await getLatestBuildByBranch({
          branchId: 'branch123',
          profileId: 'profile456'
        })

        expect(result).toEqual(mockBuilds[0])
        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/builds?branchId=branch123&profileId=profile456',
          { headers: mockGetHeaders() }
        )
      })

      it('should return null when no builds exist', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })

        const result = await getLatestBuildByBranch({
          branchId: 'branch123',
          profileId: 'profile456'
        })

        expect(result).toBeNull()
      })

      it('should handle API errors gracefully', async () => {
        mockAppcircleApi.get.mockRejectedValue(new Error('API Error'))

        const result = await getLatestBuildByBranch({
          branchId: 'branch123',
          profileId: 'profile456'
        })

        expect(result).toBeNull()
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Builds listing error:')
        )
      })

      it('should handle null response data', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: null })

        const result = await getLatestBuildByBranch({
          branchId: 'branch123',
          profileId: 'profile456'
        })

        expect(result).toBeNull()
      })
    })

    describe('getEnvironmentVariableGroups', () => {
      it('should fetch environment variable groups', async () => {
        const mockGroups = [
          { id: 'group1', name: 'Production' },
          { id: 'group2', name: 'Staging' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockGroups })

        const result = await getEnvironmentVariableGroups()

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/variable-groups',
          { headers: mockGetHeaders() }
        )
        expect(result).toEqual(mockGroups)
      })

      it('should handle empty groups list', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })

        const result = await getEnvironmentVariableGroups()
        expect(result).toEqual([])
      })
    })

    describe('createEnvironmentVariableGroup', () => {
      it('should create environment variable group', async () => {
        const mockGroup = { id: 'group123', name: 'New Group', variables: [] }
        mockAppcircleApi.post.mockResolvedValue({ data: mockGroup })

        const result = await createEnvironmentVariableGroup({ name: 'New Group' })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'build/v1/variable-groups',
          { name: 'New Group', variables: [] },
          { headers: mockGetHeaders() }
        )
        expect(result).toEqual(mockGroup)
      })

      it('should handle creation errors', async () => {
        mockAppcircleApi.post.mockRejectedValue(new Error('Creation failed'))

        await expect(createEnvironmentVariableGroup({ name: 'New Group' }))
          .rejects.toThrow('Creation failed')
      })
    })

    describe('getEnvironmentVariables', () => {
      it('should fetch environment variables for group', async () => {
        const mockVariables = [
          { id: 'var1', key: 'API_URL', value: 'https://api.example.com' },
          { id: 'var2', key: 'DEBUG', value: 'true' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockVariables })

        const result = await getEnvironmentVariables({ variableGroupId: 'group123' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/variable-groups/group123/variables',
          { headers: mockGetHeaders() }
        )
        expect(result).toEqual(mockVariables)
      })

      it('should handle no variables found', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })

        const result = await getEnvironmentVariables({ variableGroupId: 'group123' })
        expect(result).toEqual([])
      })
    })

    describe('getWorkflows', () => {
      it('should fetch workflows for profile', async () => {
        const mockWorkflows = [
          { id: 'workflow1', name: 'Build & Test' },
          { id: 'workflow2', name: 'Release' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockWorkflows })

        const result = await getWorkflows({ profileId: 'profile123' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v2/profiles/profile123/workflows',
          { headers: mockGetHeaders() }
        )
        expect(result).toEqual(mockWorkflows)
      })
    })

    describe('getConfigurations', () => {
      it('should fetch configurations for profile', async () => {
        const mockConfigurations = [
          { item1: { id: 'config1', name: 'Debug' } },
          { item1: { id: 'config2', name: 'Release' } }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockConfigurations })

        const result = await getConfigurations({ profileId: 'profile123' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v2/profiles/profile123/configurations',
          { headers: mockGetHeaders() }
        )
        expect(result).toEqual(mockConfigurations)
      })
    })

    describe('getBranches', () => {
      it('should fetch branches for profile', async () => {
        const mockBranches = {
          branches: [
            { id: 'branch1', name: 'main' },
            { id: 'branch2', name: 'develop' }
          ]
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockBranches })

        const result = await getBranches({ profileId: 'profile123' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/profiles/profile123',
          { headers: mockGetHeaders() }
        )
        expect(result).toEqual(mockBranches)
      })

      it('should handle showConsole parameter', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: { branches: [] } })

        await getBranches({ profileId: 'profile123' }, false)

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'build/v1/profiles/profile123',
          expect.any(Object)
        )
      })
    })
  })

  // Add the final closing brace for the describe block
})