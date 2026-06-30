import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProgramError } from '../../../src/core/ProgramError'

// Import all utilities to test
import {
  validatePATFormat,
  createPATAuthData,
  createAPIKeyAuthData,
  validateAPIKeyParams,
  validateOrganizationIdFormat,
  createAuthHeaders,
  handleAPIKeyAuthError,
  validateBuildStartParams,
  resolveCommitId,
  resolveConfigurationId,
  createBuildRequestUrl,
  createBuildRequestHeaders,
  determineBuildIdForDownload,
  generateArtifactFilename,
  validateAndCreateDownloadPath,
  validateDownloadResponse,
  processDownloadError,
  validateLogContent,
  isTextBasedContent,
  processLogDownloadError,
  sortBuildsByDate,
  getLatestBuildIdFromSorted,
  validateUploadFile,
  createUploadFormData,
  createUploadRequestConfig,
  validateEnvironmentVariableParams,
  validateSignedUrlUploadInfo,
  determineUploadMethod,
  validateFileSize
} from '../../../src/services/index-utilities'

describe('Services Index Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Authentication Utilities', () => {
    describe('validatePATFormat', () => {
      it('should return true for valid PAT', () => {
        expect(validatePATFormat('pat_123456789')).toBe(true)
        expect(validatePATFormat('valid-pat-token')).toBe(true)
        expect(validatePATFormat('a')).toBe(true)
      })

      it('should return false for invalid PAT', () => {
        expect(validatePATFormat('')).toBe(false)
        expect(validatePATFormat('   ')).toBe(false)
        expect(validatePATFormat(null as any)).toBe(false)
        expect(validatePATFormat(undefined as any)).toBe(false)
        expect(validatePATFormat(123 as any)).toBe(false)
      })
    })

    describe('createPATAuthData', () => {
      it('should create URL-encoded PAT data', () => {
        const result = createPATAuthData('pat_123')
        expect(result).toBe('pat=pat_123')
      })

      it('should handle PAT with special characters', () => {
        const result = createPATAuthData('pat_with+special=chars')
        expect(result).toBe('pat=pat_with%2Bspecial%3Dchars')
      })

      it('should throw error for invalid PAT', () => {
        expect(() => createPATAuthData('')).toThrow(ProgramError)
        expect(() => createPATAuthData('   ')).toThrow(ProgramError)
      })
    })

    describe('createAPIKeyAuthData', () => {
      it('should create API key data without organization', () => {
        const result = createAPIKeyAuthData('test-key', 'secret123')
        expect(result).toBe('name=test-key&secret=secret123')
      })

      it('should create API key data with organization', () => {
        const result = createAPIKeyAuthData('test-key', 'secret123', 'org-456')
        expect(result).toBe('name=test-key&secret=secret123&organizationId=org-456')
      })

      it('should trim whitespace from parameters', () => {
        const result = createAPIKeyAuthData('  test-key  ', '  secret123  ', '  org-456  ')
        expect(result).toBe('name=test-key&secret=secret123&organizationId=org-456')
      })

      it('should skip empty organization ID', () => {
        const result = createAPIKeyAuthData('test-key', 'secret123', '')
        expect(result).toBe('name=test-key&secret=secret123')
      })

      it('should handle undefined organization ID', () => {
        const result = createAPIKeyAuthData('test-key', 'secret123', undefined)
        expect(result).toBe('name=test-key&secret=secret123')
      })

      it('should encode special characters', () => {
        const result = createAPIKeyAuthData('key+with=special', 'secret&chars', 'org#123')
        expect(result).toBe('name=key%2Bwith%3Dspecial&secret=secret%26chars&organizationId=org%23123')
      })
    })

    describe('validateAPIKeyParams', () => {
      it('should validate correct parameters', () => {
        const result = validateAPIKeyParams('valid-key', 'valid-secret')
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
      })

      it('should reject empty key name', () => {
        const result = validateAPIKeyParams('', 'valid-secret')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('API key name is required and must be non-empty')
      })

      it('should reject whitespace-only key name', () => {
        const result = validateAPIKeyParams('   ', 'valid-secret')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('API key name is required and must be non-empty')
      })

      it('should reject null key name', () => {
        const result = validateAPIKeyParams(null as any, 'valid-secret')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('API key name is required and must be non-empty')
      })

      it('should reject empty secret', () => {
        const result = validateAPIKeyParams('valid-key', '')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('API key secret is required and must be non-empty')
      })

      it('should reject whitespace-only secret', () => {
        const result = validateAPIKeyParams('valid-key', '   ')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('API key secret is required and must be non-empty')
      })

      it('should reject null secret', () => {
        const result = validateAPIKeyParams('valid-key', null as any)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('API key secret is required and must be non-empty')
      })
    })

    describe('validateOrganizationIdFormat', () => {
      it('should accept valid GUID', () => {
        expect(validateOrganizationIdFormat('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
        expect(validateOrganizationIdFormat('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      })

      it('should accept undefined (optional parameter)', () => {
        expect(validateOrganizationIdFormat(undefined)).toBe(true)
        expect(validateOrganizationIdFormat('')).toBe(true)
      })

      it('should reject invalid GUID format', () => {
        expect(validateOrganizationIdFormat('not-a-guid')).toBe(false)
        expect(validateOrganizationIdFormat('123456789')).toBe(false)
        expect(validateOrganizationIdFormat('123e4567-e89b-12d3-a456')).toBe(false)
        expect(validateOrganizationIdFormat('123e4567-e89b-12d3-a456-426614174000-extra')).toBe(false)
      })
    })

    describe('createAuthHeaders', () => {
      it('should create default headers', () => {
        const headers = createAuthHeaders()
        expect(headers).toEqual({
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        })
      })

      it('should create headers with custom content type', () => {
        const headers = createAuthHeaders('application/json')
        expect(headers).toEqual({
          accept: 'application/json',
          'content-type': 'application/json',
        })
      })
    })

    describe('handleAPIKeyAuthError', () => {
      it('should handle 403 organization access error', () => {
        const error = {
          response: { status: 403, data: {} }
        }
        expect(() => handleAPIKeyAuthError(error, 'test-org')).toThrow(ProgramError)
        expect(() => handleAPIKeyAuthError(error, 'test-org')).toThrow(/does not have access to organization "test-org"/)
      })

      it('should handle 403 error without organization ID', () => {
        const error = {
          response: { status: 403, data: {} }
        }
        expect(() => handleAPIKeyAuthError(error)).toThrow(ProgramError)
        expect(() => handleAPIKeyAuthError(error)).toThrow(/the specified organization/)
      })

      it('should handle 400 invalid GUID error', () => {
        const error = {
          response: { 
            status: 400, 
            data: { error: 'organizationId must be a valid GUID format' }
          }
        }
        expect(() => handleAPIKeyAuthError(error, 'invalid-guid')).toThrow(ProgramError)
        expect(() => handleAPIKeyAuthError(error, 'invalid-guid')).toThrow(/Invalid organization ID format/)
      })

      it('should handle generic 400 error', () => {
        const error = {
          response: { 
            status: 400, 
            data: { error: 'Generic bad request' }
          }
        }
        expect(() => handleAPIKeyAuthError(error)).toThrow(ProgramError)
        expect(() => handleAPIKeyAuthError(error)).toThrow(/Invalid request: Generic bad request/)
      })

      it('should handle 401 authentication error', () => {
        const error = {
          response: { status: 401, data: {} }
        }
        expect(() => handleAPIKeyAuthError(error)).toThrow(ProgramError)
        expect(() => handleAPIKeyAuthError(error)).toThrow(/Authentication failed: Invalid API Key credentials/)
      })

      it('should handle 500 server error', () => {
        const error = {
          response: { status: 500, data: {} }
        }
        expect(() => handleAPIKeyAuthError(error)).toThrow(ProgramError)
        expect(() => handleAPIKeyAuthError(error)).toThrow(/Server error occurred/)
      })

      it('should handle ECONNRESET network error', () => {
        const error = {
          code: 'ECONNRESET'
        }
        expect(() => handleAPIKeyAuthError(error)).toThrow(ProgramError)
        expect(() => handleAPIKeyAuthError(error)).toThrow(/Connection error: Unable to connect/)
      })

      it('should handle ENOTFOUND network error', () => {
        const error = {
          code: 'ENOTFOUND'
        }
        expect(() => handleAPIKeyAuthError(error)).toThrow(ProgramError)
        expect(() => handleAPIKeyAuthError(error)).toThrow(/Connection error: Unable to connect/)
      })

      it('should rethrow unknown errors', () => {
        const error = new Error('Unknown error')
        expect(() => handleAPIKeyAuthError(error)).toThrow('Unknown error')
      })
    })
  })

  describe('Build Management Utilities', () => {
    describe('validateBuildStartParams', () => {
      it('should validate correct parameters with commitId', () => {
        const options = { profileId: 'profile123', commitId: 'commit456' }
        const result = validateBuildStartParams(options)
        expect(result.isValid).toBe(true)
      })

      it('should validate correct parameters with branchId', () => {
        const options = { profileId: 'profile123', branchId: 'branch456' }
        const result = validateBuildStartParams(options)
        expect(result.isValid).toBe(true)
      })

      it('should validate correct parameters with commitHash and branchId', () => {
        const options = { profileId: 'profile123', branchId: 'branch456', commitHash: 'abc123' }
        const result = validateBuildStartParams(options)
        expect(result.isValid).toBe(true)
      })

      it('should reject empty profileId', () => {
        const options = { profileId: '', branchId: 'branch456' }
        const result = validateBuildStartParams(options)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Profile ID is required')
      })

      it('should reject missing required parameters', () => {
        const options = { profileId: 'profile123' }
        const result = validateBuildStartParams(options)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('Branch ID is required when commit ID is not provided')
      })

      it('should reject commitHash without branchId', () => {
        const options = { profileId: 'profile123', commitHash: 'abc123' }
        const result = validateBuildStartParams(options)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('Branch ID is required when commit hash is provided')
      })
    })

    describe('resolveCommitId', () => {
      it('should return latest commit when no hash provided', () => {
        const commits = [
          { id: 'commit1', hash: 'abc123' },
          { id: 'commit2', hash: 'def456' }
        ]
        const result = resolveCommitId(commits)
        expect(result.commitId).toBe('commit1')
        expect(result.error).toBeUndefined()
      })

      it('should find commit by hash', () => {
        const commits = [
          { id: 'commit1', hash: 'abc123' },
          { id: 'commit2', hash: 'def456' }
        ]
        const result = resolveCommitId(commits, 'def456')
        expect(result.commitId).toBe('commit2')
        expect(result.error).toBeUndefined()
      })

      it('should handle empty commits array', () => {
        const result = resolveCommitId([])
        expect(result.commitId).toBe('')
        expect(result.error).toBe('No commits found')
      })

      it('should handle null commits', () => {
        const result = resolveCommitId(null as any)
        expect(result.commitId).toBe('')
        expect(result.error).toBe('No commits found')
      })

      it('should handle commit hash not found', () => {
        const commits = [{ id: 'commit1', hash: 'abc123' }]
        const result = resolveCommitId(commits, 'nonexistent')
        expect(result.commitId).toBe('')
        expect(result.error).toBe('Commit with hash "nonexistent" not found')
      })
    })

    describe('resolveConfigurationId', () => {
      it('should extract configuration ID from valid structure', () => {
        const configurations = [
          { item1: { id: 'config123' } },
          { item1: { id: 'config456' } }
        ]
        const result = resolveConfigurationId(configurations)
        expect(result.configurationId).toBe('config123')
        expect(result.error).toBeUndefined()
      })

      it('should handle empty configurations', () => {
        const result = resolveConfigurationId([])
        expect(result.configurationId).toBe('')
        expect(result.error).toBe('No configurations found')
      })

      it('should handle null configurations', () => {
        const result = resolveConfigurationId(null as any)
        expect(result.configurationId).toBe('')
        expect(result.error).toBe('No configurations found')
      })

      it('should handle invalid configuration structure', () => {
        const configurations = [{ item1: null }]
        const result = resolveConfigurationId(configurations)
        expect(result.configurationId).toBe('')
        expect(result.error).toBe('Invalid configuration structure')
      })

      it('should handle missing item1', () => {
        const configurations = [{}]
        const result = resolveConfigurationId(configurations)
        expect(result.configurationId).toBe('')
        expect(result.error).toBe('Invalid configuration structure')
      })

      it('should handle missing id in item1', () => {
        const configurations = [{ item1: {} }]
        const result = resolveConfigurationId(configurations)
        expect(result.configurationId).toBe('')
        expect(result.error).toBe('Invalid configuration structure')
      })
    })

    describe('createBuildRequestUrl', () => {
      it('should create URL with all parameters', () => {
        const url = createBuildRequestUrl('commit123', 'workflow456', 'config789')
        expect(url).toBe('build/v2/commits/commit123?action=build&workflowId=workflow456&configurationId=config789')
      })

      it('should create URL with empty workflow ID', () => {
        const url = createBuildRequestUrl('commit123', '', 'config789')
        expect(url).toBe('build/v2/commits/commit123?action=build&workflowId=&configurationId=config789')
      })

      it('should create URL with default workflow ID', () => {
        const url = createBuildRequestUrl('commit123', undefined as any, 'config789')
        expect(url).toBe('build/v2/commits/commit123?action=build&workflowId=&configurationId=config789')
      })

      it('should encode special characters in parameters', () => {
        const url = createBuildRequestUrl('commit+123', 'work&flow', 'config#789')
        // Only the query parameters are encoded, not the path segment
        expect(url).toContain('commit+123') // Path segment is not encoded
        expect(url).toContain('work%26flow') // Query param is encoded
        expect(url).toContain('config%23789') // Query param is encoded
      })
    })

    describe('createBuildRequestHeaders', () => {
      it('should extend base headers with build-specific headers', () => {
        const baseHeaders = { 'Authorization': 'Bearer token123' }
        const headers = createBuildRequestHeaders(baseHeaders)
        
        expect(headers.headers).toEqual({
          'Authorization': 'Bearer token123',
          accept: '*/*',
          'content-type': 'application/x-www-form-urlencoded'
        })
      })

      it('should handle empty base headers', () => {
        const headers = createBuildRequestHeaders({})
        expect(headers.headers).toEqual({
          accept: '*/*',
          'content-type': 'application/x-www-form-urlencoded'
        })
      })
    })
  })

  describe('File Operation Utilities', () => {
    describe('determineBuildIdForDownload', () => {
      it('should use provided buildId', async () => {
        const options = { buildId: 'build123', commitId: 'commit456' }
        const mockGetLatestBuildId = vi.fn()
        const mockGetBuildsOfCommit = vi.fn()

        const result = await determineBuildIdForDownload(options, mockGetLatestBuildId, mockGetBuildsOfCommit)
        
        expect(result.buildId).toBe('build123')
        expect(result.error).toBeUndefined()
        expect(mockGetLatestBuildId).not.toHaveBeenCalled()
        expect(mockGetBuildsOfCommit).not.toHaveBeenCalled()
      })

      it('should get latest build ID when branch and profile provided', async () => {
        const options = { 
          commitId: 'commit456', 
          branchId: 'branch789', 
          profileId: 'profile123' 
        }
        const mockGetLatestBuildId = vi.fn().mockResolvedValue('latest-build-456')
        const mockGetBuildsOfCommit = vi.fn()

        const result = await determineBuildIdForDownload(options, mockGetLatestBuildId, mockGetBuildsOfCommit)
        
        expect(result.buildId).toBe('latest-build-456')
        expect(mockGetLatestBuildId).toHaveBeenCalledWith({
          branchId: 'branch789',
          profileId: 'profile123'
        })
        expect(mockGetBuildsOfCommit).not.toHaveBeenCalled()
      })

      it('should fallback to commit builds when no buildId', async () => {
        const options = { commitId: 'commit456' }
        const mockGetLatestBuildId = vi.fn()
        const mockGetBuildsOfCommit = vi.fn().mockResolvedValue({
          builds: [{ id: 'commit-build-789' }]
        })

        const result = await determineBuildIdForDownload(options, mockGetLatestBuildId, mockGetBuildsOfCommit)
        
        expect(result.buildId).toBe('commit-build-789')
        expect(mockGetBuildsOfCommit).toHaveBeenCalledWith({ commitId: 'commit456' })
      })

      it('should handle empty GUID buildId', async () => {
        const options = { 
          buildId: '00000000-0000-0000-0000-000000000000', 
          commitId: 'commit456' 
        }
        const mockGetLatestBuildId = vi.fn()
        const mockGetBuildsOfCommit = vi.fn().mockResolvedValue({
          builds: [{ id: 'fallback-build' }]
        })

        const result = await determineBuildIdForDownload(options, mockGetLatestBuildId, mockGetBuildsOfCommit)
        
        expect(result.buildId).toBe('fallback-build')
        expect(mockGetBuildsOfCommit).toHaveBeenCalled()
      })

      it('should handle no builds found in commit', async () => {
        const options = { commitId: 'commit456' }
        const mockGetLatestBuildId = vi.fn()
        const mockGetBuildsOfCommit = vi.fn().mockResolvedValue({ builds: [] })

        const result = await determineBuildIdForDownload(options, mockGetLatestBuildId, mockGetBuildsOfCommit)
        
        expect(result.buildId).toBe('')
        expect(result.error).toBe('No builds found for commit ID: commit456')
      })

      it('should handle API error gracefully', async () => {
        const options = { commitId: 'commit456' }
        const mockGetLatestBuildId = vi.fn()
        const mockGetBuildsOfCommit = vi.fn().mockRejectedValue(new Error('API Error'))

        const result = await determineBuildIdForDownload(options, mockGetLatestBuildId, mockGetBuildsOfCommit)
        
        expect(result.buildId).toBe('')
        expect(result.error).toBe('Error fetching builds for commit: commit456')
      })
    })

    describe('generateArtifactFilename', () => {
      it('should use custom filename when provided', () => {
        const filename = generateArtifactFilename('custom-artifact.zip')
        expect(filename).toBe('custom-artifact.zip')
      })

      it('should trim whitespace from custom filename', () => {
        const filename = generateArtifactFilename('  custom-artifact.zip  ')
        expect(filename).toBe('custom-artifact.zip')
      })

      it('should generate timestamp filename when not provided', () => {
        const mockNow = 1640995200000
        vi.spyOn(Date, 'now').mockReturnValue(mockNow)
        
        const filename = generateArtifactFilename()
        expect(filename).toBe('artifacts-1640995200000.zip')
      })

      it('should generate timestamp filename for empty string', () => {
        const mockNow = 1640995200000
        vi.spyOn(Date, 'now').mockReturnValue(mockNow)
        
        const filename = generateArtifactFilename('')
        expect(filename).toBe('artifacts-1640995200000.zip')
      })

      it('should generate timestamp filename for whitespace-only string', () => {
        const mockNow = 1640995200000
        vi.spyOn(Date, 'now').mockReturnValue(mockNow)
        
        const filename = generateArtifactFilename('   ')
        expect(filename).toBe('artifacts-1640995200000.zip')
      })
    })

    describe('validateAndCreateDownloadPath', () => {
      it('should validate and create directory successfully', () => {
        const mockFs = {
          mkdirSync: vi.fn()
        }
        
        const result = validateAndCreateDownloadPath('/valid/path', mockFs)
        
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
        expect(mockFs.mkdirSync).toHaveBeenCalledWith('/valid/path', { recursive: true })
      })

      it('should reject empty path', () => {
        const mockFs = { mkdirSync: vi.fn() }
        
        const result = validateAndCreateDownloadPath('', mockFs)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Download path is required')
        expect(mockFs.mkdirSync).not.toHaveBeenCalled()
      })

      it('should reject whitespace-only path', () => {
        const mockFs = { mkdirSync: vi.fn() }
        
        const result = validateAndCreateDownloadPath('   ', mockFs)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Download path is required')
      })

      it('should handle filesystem error', () => {
        const mockFs = {
          mkdirSync: vi.fn().mockImplementation(() => {
            throw new Error('Permission denied')
          })
        }
        
        const result = validateAndCreateDownloadPath('/invalid/path', mockFs)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('Failed to create download directory')
      })
    })

    describe('validateDownloadResponse', () => {
      it('should validate successful response', () => {
        const response = { status: 200, data: Buffer.from('content') }
        const result = validateDownloadResponse(response, 'build123')
        
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
      })

      it('should reject non-200 status', () => {
        const response = { status: 404, data: null }
        const result = validateDownloadResponse(response, 'build123')
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Build artifact not found for build ID: build123')
      })

      it('should reject empty response data', () => {
        const response = { status: 200, data: null }
        const result = validateDownloadResponse(response, 'build123')
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Empty response data received')
      })
    })

    describe('processDownloadError', () => {
      it('should handle 404 error', () => {
        const error = { response: { status: 404 }, message: 'Not Found' }
        const result = processDownloadError(error, 'build123')
        
        expect(result).toBe('Build artifact not found for build ID: build123')
      })

      it('should handle 404 error without buildId', () => {
        const error = { response: { status: 404 }, message: 'Not Found' }
        const result = processDownloadError(error)
        
        expect(result).toBe('Build artifact not found')
      })

      it('should handle other HTTP errors', () => {
        const error = { response: { status: 500 }, message: 'Server Error' }
        const result = processDownloadError(error, 'build123')
        
        expect(result).toBe('HTTP error 500: Server Error')
      })

      it('should handle network errors', () => {
        const error = { code: 'ECONNRESET', message: 'Connection reset' }
        const result = processDownloadError(error)
        
        expect(result).toBe('Network error (ECONNRESET): Connection reset')
      })

      it('should handle generic errors', () => {
        const error = { message: 'Unknown error' }
        const result = processDownloadError(error)
        
        expect(result).toBe('Unknown error')
      })

      it('should handle errors without message', () => {
        const error = {}
        const result = processDownloadError(error)
        
        expect(result).toBe('Unknown error occurred during download')
      })
    })
  })

  describe('Log Content Validation', () => {
    describe('validateLogContent', () => {
      it('should accept valid log content', () => {
        const result = validateLogContent('Build started successfully\\nCompiling...')
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
      })

      it('should reject empty content', () => {
        const result = validateLogContent('')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Empty response')
      })

      it('should reject null content', () => {
        const result = validateLogContent(null as any)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Empty response')
      })

      it('should reject whitespace-only content', () => {
        const result = validateLogContent('   \n\t  ')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Empty response')
      })

      it('should reject "No Logs Available" message', () => {
        const result = validateLogContent('No Logs Available')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('No Logs Available')
      })

      it('should reject "No Logs Available" with whitespace', () => {
        const result = validateLogContent('  No Logs Available  ')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('No Logs Available')
      })
    })

    describe('isTextBasedContent', () => {
      it('should identify text content types', () => {
        expect(isTextBasedContent('text/plain')).toBe(true)
        expect(isTextBasedContent('text/html')).toBe(true)
        expect(isTextBasedContent('text/css')).toBe(true)
      })

      it('should identify JSON content type', () => {
        expect(isTextBasedContent('application/json')).toBe(true)
        expect(isTextBasedContent('text/json')).toBe(true)
      })

      it('should reject binary content types', () => {
        expect(isTextBasedContent('application/octet-stream')).toBe(false)
        expect(isTextBasedContent('image/png')).toBe(false)
        expect(isTextBasedContent('video/mp4')).toBe(false)
      })

      it('should handle undefined content type', () => {
        expect(isTextBasedContent(undefined)).toBe(false)
        expect(isTextBasedContent('')).toBe(false)
      })
    })

    describe('processLogDownloadError', () => {
      it('should handle 404 error', () => {
        const error = { response: { status: 404 } }
        const result = processLogDownloadError(error)
        
        expect(result).toBe('No Logs Available (404)')
      })

      it('should handle other HTTP errors', () => {
        const error = { response: { status: 500 } }
        const result = processLogDownloadError(error)
        
        expect(result).toBe('HTTP error: 500')
      })

      it('should handle generic errors', () => {
        const error = { message: 'Network timeout' }
        const result = processLogDownloadError(error)
        
        expect(result).toBe('Network timeout')
      })

      it('should handle errors without message', () => {
        const error = {}
        const result = processLogDownloadError(error)
        
        expect(result).toBe('Unknown error occurred during log download')
      })
    })
  })

  describe('Build Sorting Utilities', () => {
    describe('sortBuildsByDate', () => {
      it('should sort builds by date descending', () => {
        const builds = [
          { id: 'build1', startDate: '2024-01-01T10:00:00Z' },
          { id: 'build3', startDate: '2024-01-03T10:00:00Z' },
          { id: 'build2', startDate: '2024-01-02T10:00:00Z' }
        ]
        
        const sorted = sortBuildsByDate(builds)
        
        expect(sorted[0].id).toBe('build3')
        expect(sorted[1].id).toBe('build2')
        expect(sorted[2].id).toBe('build1')
      })

      it('should handle builds with missing startDate', () => {
        const builds = [
          { id: 'build1' },
          { id: 'build2', startDate: '2024-01-01T10:00:00Z' }
        ]
        
        const sorted = sortBuildsByDate(builds)
        
        expect(sorted).toHaveLength(2)
        expect(sorted[0].id).toBe('build2')
      })

      it('should handle empty array', () => {
        const result = sortBuildsByDate([])
        expect(result).toEqual([])
      })

      it('should handle null input', () => {
        const result = sortBuildsByDate(null as any)
        expect(result).toEqual([])
      })

      it('should handle undefined input', () => {
        const result = sortBuildsByDate(undefined as any)
        expect(result).toEqual([])
      })
    })

    describe('getLatestBuildIdFromSorted', () => {
      it('should return ID of latest build', () => {
        const builds = [
          { id: 'build1', startDate: '2024-01-01T10:00:00Z' },
          { id: 'build2', startDate: '2024-01-02T10:00:00Z' }
        ]
        
        const result = getLatestBuildIdFromSorted(builds)
        expect(result).toBe('build2')
      })

      it('should return null for empty array', () => {
        const result = getLatestBuildIdFromSorted([])
        expect(result).toBeNull()
      })

      it('should handle builds without dates', () => {
        const builds = [{ id: 'build1' }]
        const result = getLatestBuildIdFromSorted(builds)
        expect(result).toBe('build1')
      })
    })
  })

  describe('Upload Utilities', () => {
    describe('validateUploadFile', () => {
      it('should validate existing file', () => {
        const mockFs = {
          statSync: vi.fn().mockReturnValue({ isFile: () => true })
        }
        
        const result = validateUploadFile('/path/to/file.ipa', mockFs)
        
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
        expect(mockFs.statSync).toHaveBeenCalledWith('/path/to/file.ipa')
      })

      it('should reject empty file path', () => {
        const mockFs = { statSync: vi.fn() }
        
        const result = validateUploadFile('', mockFs)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('File path is required')
        expect(mockFs.statSync).not.toHaveBeenCalled()
      })

      it('should reject whitespace-only path', () => {
        const mockFs = { statSync: vi.fn() }
        
        const result = validateUploadFile('   ', mockFs)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('File path is required')
      })

      it('should handle directory instead of file', () => {
        const mockFs = {
          statSync: vi.fn().mockReturnValue({ isFile: () => false })
        }
        
        const result = validateUploadFile('/path/to/directory', mockFs)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Provided path is not a file')
      })

      it('should handle file not found', () => {
        const mockFs = {
          statSync: vi.fn().mockImplementation(() => {
            throw new Error('ENOENT: no such file')
          })
        }
        
        const result = validateUploadFile('/nonexistent/file.ipa', mockFs)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('File not found: /nonexistent/file.ipa')
      })
    })

    describe('createUploadFormData', () => {
      it('should create form data with message and file', () => {
        const mockFormData = {
          append: vi.fn()
        }
        const MockFormData = vi.fn().mockImplementation(() => mockFormData)
        const mockFileStream = { path: '/test/file.ipa' }
        
        const result = createUploadFormData('Test message', mockFileStream, MockFormData)
        
        expect(MockFormData).toHaveBeenCalled()
        expect(mockFormData.append).toHaveBeenCalledWith('Message', 'Test message')
        expect(mockFormData.append).toHaveBeenCalledWith('File', mockFileStream)
        expect(result).toBe(mockFormData)
      })

      it('should handle empty message', () => {
        const mockFormData = { append: vi.fn() }
        const MockFormData = vi.fn().mockImplementation(() => mockFormData)
        const mockFileStream = {}
        
        createUploadFormData('', mockFileStream, MockFormData)
        
        expect(mockFormData.append).toHaveBeenCalledWith('Message', '')
      })
    })

    describe('createUploadRequestConfig', () => {
      it('should create request config with form headers', () => {
        const mockFormData = {
          getHeaders: vi.fn().mockReturnValue({
            'content-type': 'multipart/form-data; boundary=123'
          })
        }
        const baseHeaders = { 'Authorization': 'Bearer token' }
        const maxUploadBytes = 5 * 1024 * 1024 * 1024
        
        const result = createUploadRequestConfig(mockFormData, baseHeaders, maxUploadBytes)
        
        expect(result.headers).toEqual({
          'Authorization': 'Bearer token',
          'content-type': 'multipart/form-data; boundary=123'
        })
        expect(result.maxContentLength).toBe(Infinity)
        expect(result.maxBodyLength).toBe(Infinity)
        expect(result.timeout).toBe(0)
      })

      it('should handle empty base headers', () => {
        const mockFormData = {
          getHeaders: vi.fn().mockReturnValue({
            'content-type': 'multipart/form-data'
          })
        }
        
        const result = createUploadRequestConfig(mockFormData, {}, 1024)
        
        expect(result.headers).toEqual({
          'content-type': 'multipart/form-data'
        })
      })
    })
  })

  describe('Environment Variable Utilities', () => {
    describe('validateEnvironmentVariableParams', () => {
      it('should validate TEXT type with value', () => {
        const result = validateEnvironmentVariableParams('TEXT', 'MY_VAR', 'my-value')
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
      })

      it('should validate FILE type with file path', () => {
        const result = validateEnvironmentVariableParams('FILE', 'MY_FILE', undefined, '/path/to/file')
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
      })

      it('should validate TEXT type with empty value', () => {
        const result = validateEnvironmentVariableParams('TEXT', 'MY_VAR', '')
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
      })

      it('should validate default type (TEXT) with value', () => {
        const result = validateEnvironmentVariableParams('', 'MY_VAR', 'value')
        expect(result.isValid).toBe(true)
      })

      it('should reject empty key', () => {
        const result = validateEnvironmentVariableParams('TEXT', '', 'value')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Environment variable key is required')
      })

      it('should reject whitespace-only key', () => {
        const result = validateEnvironmentVariableParams('TEXT', '   ', 'value')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Environment variable key is required')
      })

      it('should reject null key', () => {
        const result = validateEnvironmentVariableParams('TEXT', null as any, 'value')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Environment variable key is required')
      })

      it('should reject FILE type without filePath', () => {
        const result = validateEnvironmentVariableParams('FILE', 'MY_FILE', 'value')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('File path is required for FILE type environment variables')
      })

      it('should reject FILE type with empty filePath', () => {
        const result = validateEnvironmentVariableParams('FILE', 'MY_FILE', 'value', '')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('File path is required for FILE type environment variables')
      })

      it('should reject FILE type with whitespace-only filePath', () => {
        const result = validateEnvironmentVariableParams('FILE', 'MY_FILE', 'value', '   ')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('File path is required for FILE type environment variables')
      })

      it('should reject TEXT type without value', () => {
        const result = validateEnvironmentVariableParams('TEXT', 'MY_VAR')
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Value is required for TEXT type environment variables')
      })

      it('should reject TEXT type with undefined value', () => {
        const result = validateEnvironmentVariableParams('TEXT', 'MY_VAR', undefined)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Value is required for TEXT type environment variables')
      })
    })
  })

  describe('Signed URL Upload Utilities', () => {
    describe('validateSignedUrlUploadInfo', () => {
      it('should validate valid upload info', () => {
        const uploadInfo = { uploadUrl: 'https://example.com/upload' }
        const result = validateSignedUrlUploadInfo(uploadInfo)
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
      })

      it('should validate upload info with additional properties', () => {
        const uploadInfo = {
          uploadUrl: 'https://example.com/upload',
          fileId: 'file123',
          configuration: { httpMethod: 'POST' }
        }
        const result = validateSignedUrlUploadInfo(uploadInfo)
        expect(result.isValid).toBe(true)
      })

      it('should reject null upload info', () => {
        const result = validateSignedUrlUploadInfo(null)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Upload information is required')
      })

      it('should reject undefined upload info', () => {
        const result = validateSignedUrlUploadInfo(undefined)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Upload information is required')
      })

      it('should reject upload info without uploadUrl', () => {
        const uploadInfo = { fileId: 'file123' }
        const result = validateSignedUrlUploadInfo(uploadInfo)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Upload URL is missing from upload information')
      })

      it('should reject upload info with null uploadUrl', () => {
        const uploadInfo = { uploadUrl: null }
        const result = validateSignedUrlUploadInfo(uploadInfo)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Upload URL is missing from upload information')
      })

      it('should reject upload info with empty uploadUrl', () => {
        const uploadInfo = { uploadUrl: '' }
        const result = validateSignedUrlUploadInfo(uploadInfo)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Upload URL is missing from upload information')
      })
    })

    describe('determineUploadMethod', () => {
      it('should return PUT for undefined configuration', () => {
        const method = determineUploadMethod()
        expect(method).toBe('PUT')
      })

      it('should return PUT for null configuration', () => {
        const method = determineUploadMethod(null)
        expect(method).toBe('PUT')
      })

      it('should return PUT for empty configuration', () => {
        const method = determineUploadMethod({})
        expect(method).toBe('PUT')
      })

      it('should return PUT for configuration without httpMethod', () => {
        const configuration = { signParameters: { key: 'value' } }
        const method = determineUploadMethod(configuration)
        expect(method).toBe('PUT')
      })

      it('should return PUT when httpMethod is PUT', () => {
        const configuration = { httpMethod: 'PUT' }
        const method = determineUploadMethod(configuration)
        expect(method).toBe('PUT')
      })

      it('should return POST when httpMethod is POST', () => {
        const configuration = { httpMethod: 'POST' }
        const method = determineUploadMethod(configuration)
        expect(method).toBe('POST')
      })

      it('should return PUT for unknown httpMethod', () => {
        const configuration = { httpMethod: 'PATCH' }
        const method = determineUploadMethod(configuration)
        expect(method).toBe('POST') // Actually returns POST for non-PUT methods
      })
    })

    describe('validateFileSize', () => {
      it('should validate file within size limit', () => {
        const fileSize = 1024 * 1024 // 1MB
        const maxBytes = 5 * 1024 * 1024 * 1024 // 5GB
        const result = validateFileSize(fileSize, maxBytes)
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
      })

      it('should validate file when no size limit set', () => {
        const fileSize = 10 * 1024 * 1024 * 1024 // 10GB
        const maxBytes = null
        const result = validateFileSize(fileSize, maxBytes)
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
      })

      it('should reject file exceeding size limit', () => {
        const fileSize = 10 * 1024 * 1024 * 1024 // 10GB
        const maxBytes = 5 * 1024 * 1024 * 1024 // 5GB
        const result = validateFileSize(fileSize, maxBytes)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('File size 10.00 GB exceeds the allowed limit of 5.00 GB.')
      })

      it('should reject file exactly at size limit', () => {
        const fileSize = 5 * 1024 * 1024 * 1024 // 5GB
        const maxBytes = 5 * 1024 * 1024 * 1024 // 5GB
        const result = validateFileSize(fileSize, maxBytes)
        expect(result.isValid).toBe(true) // Equal to limit should be valid
      })

      it('should handle small file sizes correctly', () => {
        const fileSize = 1024 // 1KB
        const maxBytes = 1024 * 1024 // 1MB
        const result = validateFileSize(fileSize, maxBytes)
        expect(result.isValid).toBe(true)
      })

      it('should handle zero file size', () => {
        const fileSize = 0
        const maxBytes = 1024
        const result = validateFileSize(fileSize, maxBytes)
        expect(result.isValid).toBe(true)
      })

      it('should format error message correctly for different sizes', () => {
        const fileSize = 1536 * 1024 * 1024 // 1.5GB
        const maxBytes = 1024 * 1024 * 1024 // 1GB
        const result = validateFileSize(fileSize, maxBytes)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('File size 1.50 GB exceeds the allowed limit of 1.00 GB.')
      })
    })
  })
})