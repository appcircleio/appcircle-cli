import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import FormData from 'form-data'

// Mock dependencies first
vi.mock('fs')
vi.mock('form-data')

vi.mock('../../../src/services/api.js', () => ({
  appcircleApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  },
  getHeaders: vi.fn(() => ({
    'Authorization': 'Bearer test-token',
    'Content-Type': 'application/json'
  }))
}))

// Import functions after mocking
import {
  getEnterpriseUploadInformation,
  commitEnterpriseFileUpload,
  getEnterpriseProfiles,
  getEnterpriseAppVersions,
  publishEnterpriseAppVersion,
  unpublishEnterpriseAppVersion,
  removeEnterpriseAppVersion,
  notifyEnterpriseAppVersion,
  uploadEnterpriseAppVersion,
  uploadEnterpriseApp,
  getEnterpriseDownloadLink
} from '../../../src/services/enterprise-store'

import { appcircleApi, getHeaders } from '../../../src/services/api'

const mockAppcircleApi = appcircleApi as any
const mockGetHeaders = getHeaders as any
const mockFs = vi.mocked(fs)
const MockFormData = vi.mocked(FormData)

describe('Enterprise Store Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    MockFormData.prototype.append = vi.fn()
    MockFormData.prototype.getHeaders = vi.fn(() => ({
      'content-type': 'multipart/form-data; boundary=test'
    }))
    MockFormData.prototype.getBoundary = vi.fn(() => 'test-boundary')
  })

  describe('File Upload Operations', () => {
    describe('getEnterpriseUploadInformation', () => {
      it('should get upload information with proper URL encoding', async () => {
        const mockUploadInfo = {
          uploadUrl: 'https://upload.example.com',
          fileId: 12345
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockUploadInfo })

        const result = await getEnterpriseUploadInformation({
          fileSize: 5000000,
          fileName: 'Enterprise App (v2.0) [Release].ipa'
        })

        const expectedUrl = 'store/v1/profiles/app-versions' +
          '?action=uploadInformation&fileSize=5000000&fileName=Enterprise App (v2.0) [Release].ipa'

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          expectedUrl,
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockUploadInfo)
      })

      it('should handle special characters in filename', async () => {
        const mockUploadInfo = { uploadUrl: 'https://upload.example.com' }
        mockAppcircleApi.get.mockResolvedValue({ data: mockUploadInfo })

        await getEnterpriseUploadInformation({
          fileSize: 1024,
          fileName: 'App & More (2024) #special.ipa'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          expect.stringContaining('App & More (2024) #special.ipa'),
          expect.any(Object)
        )
      })

      it('should handle zero file size', async () => {
        const mockUploadInfo = { uploadUrl: 'https://upload.example.com' }
        mockAppcircleApi.get.mockResolvedValue({ data: mockUploadInfo })

        await getEnterpriseUploadInformation({
          fileSize: 0,
          fileName: 'app.ipa'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          expect.stringContaining('fileSize=0'),
          expect.any(Object)
        )
      })

      it('should handle extremely large file sizes', async () => {
        const largeFileError = new Error('File too large')
        mockAppcircleApi.get.mockRejectedValue(largeFileError)

        await expect(getEnterpriseUploadInformation({
          fileSize: 50000000000, // 50GB
          fileName: 'huge-app.ipa'
        })).rejects.toThrow('File too large')
      })

      it('should handle empty filename', async () => {
        const mockUploadInfo = { uploadUrl: 'https://upload.example.com' }
        mockAppcircleApi.get.mockResolvedValue({ data: mockUploadInfo })

        await getEnterpriseUploadInformation({
          fileSize: 1024,
          fileName: ''
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          expect.stringContaining('fileName='),
          expect.any(Object)
        )
      })

      it('should handle Unicode filenames', async () => {
        const unicodeFilename = 'مَثَال_テスト_测试.ipa'
        const mockUploadInfo = { uploadUrl: 'https://upload.example.com' }
        mockAppcircleApi.get.mockResolvedValue({ data: mockUploadInfo })

        await getEnterpriseUploadInformation({
          fileSize: 2048,
          fileName: unicodeFilename
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          expect.stringContaining(unicodeFilename),
          expect.any(Object)
        )
      })

      it('should handle network timeout errors', async () => {
        const timeoutError = new Error('timeout of 30000ms exceeded')
        mockAppcircleApi.get.mockRejectedValue(timeoutError)

        await expect(getEnterpriseUploadInformation({
          fileSize: 1024,
          fileName: 'app.ipa'
        })).rejects.toThrow(/timeout/)
      })
    })

    describe('commitEnterpriseFileUpload', () => {
      it('should commit upload with createNewProfile=true when entProfileId is undefined', async () => {
        const mockResponse = { success: true, profileId: 'new123' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await commitEnterpriseFileUpload({
          fileId: 123,
          fileName: 'app.ipa'
          // entProfileId: undefined (omitted)
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'store/v1/profiles/app-versions?action=commitFileUpload&createNewProfile=true',
          { fileId: 123, fileName: 'app.ipa' },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should commit upload with existing profile ID', async () => {
        const mockResponse = { success: true }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await commitEnterpriseFileUpload({
          fileId: 456,
          fileName: 'app.ipa',
          entProfileId: 'profile123'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'store/v1/profiles/app-versions?action=commitFileUpload&createNewProfile=false&profileId=profile123',
          { fileId: 456, fileName: 'app.ipa' },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle invalid file ID error', async () => {
        const invalidFileError = new Error('Invalid file ID')
        mockAppcircleApi.post.mockRejectedValue(invalidFileError)

        await expect(commitEnterpriseFileUpload({
          fileId: -1,
          fileName: 'app.ipa'
        })).rejects.toThrow('Invalid file ID')
      })

      it('should handle URL parameter edge cases', async () => {
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        // Test edge case where entProfileId is empty string
        await commitEnterpriseFileUpload({
          fileId: 123,
          fileName: 'app.ipa',
          entProfileId: ''
        })

        // Should treat empty string as falsy, but createNewProfile=false because '' !== undefined
        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.stringContaining('createNewProfile=false'),
          expect.any(Object),
          expect.any(Object)
        )
      })

      it('should handle null entProfileId', async () => {
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        await commitEnterpriseFileUpload({
          fileId: 789,
          fileName: 'app.ipa',
          entProfileId: null as any
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.stringContaining('createNewProfile=false'),
          expect.any(Object),
          expect.any(Object)
        )
      })

      it('should handle file commit timeout error', async () => {
        const timeoutError = new Error('File commit timeout')
        mockAppcircleApi.post.mockRejectedValue(timeoutError)

        await expect(commitEnterpriseFileUpload({
          fileId: 123,
          fileName: 'app.ipa'
        })).rejects.toThrow('File commit timeout')
      })

      it('should handle special characters in filename during commit', async () => {
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        await commitEnterpriseFileUpload({
          fileId: 456,
          fileName: 'Complex App Name & More! (v1.0).ipa',
          entProfileId: 'profile123'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.any(String),
          { fileId: 456, fileName: 'Complex App Name & More! (v1.0).ipa' },
          expect.any(Object)
        )
      })
    })
  })

  describe('Enterprise Profile Management', () => {
    describe('getEnterpriseProfiles', () => {
      it('should fetch enterprise profiles successfully', async () => {
        const mockProfiles = [
          { id: 'profile1', name: 'iOS Enterprise', platform: 'ios' },
          { id: 'profile2', name: 'Android Enterprise', platform: 'android' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockProfiles })

        const result = await getEnterpriseProfiles()

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'store/v2/profiles',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockProfiles)
      })

      it('should handle empty profiles list', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })
        
        const result = await getEnterpriseProfiles()
        expect(result).toEqual([])
      })

      it('should handle API errors', async () => {
        const apiError = new Error('Failed to fetch profiles')
        mockAppcircleApi.get.mockRejectedValue(apiError)

        await expect(getEnterpriseProfiles()).rejects.toThrow('Failed to fetch profiles')
      })

      it('should call with proper headers', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })
        
        await getEnterpriseProfiles()

        expect(mockGetHeaders).toHaveBeenCalled()
      })

      it('should handle null response data', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: null })
        
        const result = await getEnterpriseProfiles()
        expect(result).toBeNull()
      })

      it('should handle server errors', async () => {
        const serverError = new Error('Internal Server Error')
        ;(serverError as any).response = { status: 500 }
        mockAppcircleApi.get.mockRejectedValue(serverError)

        await expect(getEnterpriseProfiles()).rejects.toThrow('Internal Server Error')
      })

      it('should handle rate limiting', async () => {
        const rateLimitError = new Error('Too Many Requests')
        ;(rateLimitError as any).response = { status: 429 }
        mockAppcircleApi.get.mockRejectedValue(rateLimitError)

        await expect(getEnterpriseProfiles()).rejects.toThrow('Too Many Requests')
      })
    })
  })

  describe('App Version Management', () => {
    describe('getEnterpriseAppVersions', () => {
      it('should fetch beta versions with publishType=1', async () => {
        const mockVersions = [{ id: 'v1', publishType: 'Beta' }]
        mockAppcircleApi.get.mockResolvedValue({ data: mockVersions })

        const result = await getEnterpriseAppVersions({
          entProfileId: 'profile123',
          publishType: '1'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'store/v2/profiles/profile123/app-versions?publishtype=Beta',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockVersions)
      })

      it('should fetch live versions with publishType=2 - documents switch bug', async () => {
        const mockVersions = [{ id: 'v1', publishType: 'Live' }]
        mockAppcircleApi.get.mockResolvedValue({ data: mockVersions })

        const result = await getEnterpriseAppVersions({
          entProfileId: 'profile123',
          publishType: '2'
        })

        // The switch statement actually works correctly - there's no missing break bug
        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'store/v2/profiles/profile123/app-versions?publishtype=Live',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockVersions)
      })

      it('should fetch all versions with default publishType', async () => {
        const mockVersions = [{ id: 'v1' }, { id: 'v2' }]
        mockAppcircleApi.get.mockResolvedValue({ data: mockVersions })

        const result = await getEnterpriseAppVersions({
          entProfileId: 'profile123',
          publishType: 'all'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'store/v2/profiles/profile123/app-versions',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockVersions)
      })

      it('should handle invalid publishType values', async () => {
        const mockVersions = [{ id: 'v1' }]
        mockAppcircleApi.get.mockResolvedValue({ data: mockVersions })

        const result = await getEnterpriseAppVersions({
          entProfileId: 'profile123',
          publishType: 'invalid'
        })

        // Currently doesn't validate, falls through to default
        expect(result).toBeDefined()
        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'store/v2/profiles/profile123/app-versions',
          expect.any(Object)
        )
      })

      it('should handle empty entProfileId', async () => {
        const mockVersions = []
        mockAppcircleApi.get.mockResolvedValue({ data: mockVersions })

        await getEnterpriseAppVersions({
          entProfileId: '',
          publishType: '1'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'store/v2/profiles//app-versions?publishtype=Beta',
          expect.any(Object)
        )
      })

      it('should handle profile not found error', async () => {
        const notFoundError = new Error('Profile not found')
        ;(notFoundError as any).response = { status: 404 }
        mockAppcircleApi.get.mockRejectedValue(notFoundError)

        await expect(getEnterpriseAppVersions({
          entProfileId: 'nonexistent',
          publishType: '1'
        })).rejects.toThrow('Profile not found')
      })

      it('should handle special characters in profile ID', async () => {
        const mockVersions = []
        mockAppcircleApi.get.mockResolvedValue({ data: mockVersions })

        await getEnterpriseAppVersions({
          entProfileId: 'profile-test_123.special',
          publishType: '1'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'store/v2/profiles/profile-test_123.special/app-versions?publishtype=Beta',
          expect.any(Object)
        )
      })
    })

    describe('publishEnterpriseAppVersion', () => {
      it('should publish app version with all parameters', async () => {
        const mockResponse = { success: true, publishedAt: '2024-01-01T00:00:00Z' }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })

        const result = await publishEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456',
          summary: 'New release',
          releaseNotes: 'Bug fixes and improvements',
          publishType: '2'
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          'store/v2/profiles/profile123/app-versions/version456?action=publish',
          {
            summary: 'New release',
            releaseNotes: 'Bug fixes and improvements',
            publishType: '2'
          },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle empty release notes', async () => {
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        await publishEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456',
          summary: 'Quick fix',
          releaseNotes: '',
          publishType: '1'
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ releaseNotes: '' }),
          expect.any(Object)
        )
      })

      it('should handle Unicode in release notes', async () => {
        const unicodeNotes = 'Yeni özellikler eklendi 🚀 ve hatalar düzeltildi'
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        await publishEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456',
          summary: 'Unicode Release',
          releaseNotes: unicodeNotes,
          publishType: '1'
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ releaseNotes: unicodeNotes }),
          expect.any(Object)
        )
      })

      it('should handle already published version error', async () => {
        const alreadyPublishedError = new Error('Version already published')
        ;(alreadyPublishedError as any).response = { status: 409 }
        mockAppcircleApi.patch.mockRejectedValue(alreadyPublishedError)

        await expect(publishEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456',
          summary: 'Test',
          releaseNotes: 'Test',
          publishType: '1'
        })).rejects.toThrow('Version already published')
      })

      it('should handle HTML content in release notes', async () => {
        const htmlNotes = '<b>Important:</b> Please backup your data before updating.'
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        await publishEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456',
          summary: 'HTML Release',
          releaseNotes: htmlNotes,
          publishType: '2'
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ releaseNotes: htmlNotes }),
          expect.any(Object)
        )
      })

      it('should handle very long release notes', async () => {
        const longNotes = 'A'.repeat(10000) + ' - Very long release notes'
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        await publishEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456',
          summary: 'Long Notes',
          releaseNotes: longNotes,
          publishType: '1'
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ releaseNotes: longNotes }),
          expect.any(Object)
        )
      })

      it('should handle insufficient permissions error', async () => {
        const permError = new Error('Insufficient permissions to publish')
        ;(permError as any).response = { status: 403 }
        mockAppcircleApi.patch.mockRejectedValue(permError)

        await expect(publishEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456',
          summary: 'Test',
          releaseNotes: 'Test',
          publishType: '2'
        })).rejects.toThrow('Insufficient permissions')
      })
    })

    describe('unpublishEnterpriseAppVersion', () => {
      it('should unpublish app version successfully', async () => {
        const mockResponse = { success: true, unpublishedAt: '2024-01-01T00:00:00Z' }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })

        const result = await unpublishEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          'store/v2/profiles/profile123/app-versions/version456?action=unpublish',
          {},
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle already unpublished version', async () => {
        const notPublishedError = new Error('Version not published')
        ;(notPublishedError as any).response = { status: 400 }
        mockAppcircleApi.patch.mockRejectedValue(notPublishedError)

        await expect(unpublishEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })).rejects.toThrow('Version not published')
      })

      it('should handle version not found error', async () => {
        const notFoundError = new Error('Version not found')
        ;(notFoundError as any).response = { status: 404 }
        mockAppcircleApi.patch.mockRejectedValue(notFoundError)

        await expect(unpublishEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'nonexistent'
        })).rejects.toThrow('Version not found')
      })

      it('should handle network timeout during unpublish', async () => {
        const timeoutError = new Error('Request timeout')
        mockAppcircleApi.patch.mockRejectedValue(timeoutError)

        await expect(unpublishEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })).rejects.toThrow('Request timeout')
      })
    })
  })

  describe('Version Removal', () => {
    describe('removeEnterpriseAppVersion', () => {
      it('should remove app version successfully', async () => {
        const mockResponse = { success: true, deletedVersionId: 'version456' }
        mockAppcircleApi.delete.mockResolvedValue({ data: mockResponse })

        const result = await removeEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })

        expect(mockAppcircleApi.delete).toHaveBeenCalledWith(
          'store/v2/profiles/profile123/app-versions/version456',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle the buggy empty array check', async () => {
        // BUG: The function checks versionResponse.data.length === 0
        // But delete responses typically return success objects, not arrays
        const mockEmptyArrayResponse = []
        mockAppcircleApi.delete.mockResolvedValue({ data: mockEmptyArrayResponse })

        const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

        const result = await removeEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })

        expect(consoleSpy).toHaveBeenCalledWith('No app versions available.')
        expect(result).toBeUndefined()
        
        consoleSpy.mockRestore()
      })

      it('should handle typical delete response object - documents bug', async () => {
        // Most delete operations return objects, not arrays
        // This would cause a runtime error due to .length on object
        const mockResponse = { success: true, message: 'Deleted successfully' }
        mockAppcircleApi.delete.mockResolvedValue({ data: mockResponse })

        // The function will try to access .length on the object
        // Objects don't have length property, so it will be undefined
        // undefined === 0 is false, so it will return the object
        const result = await removeEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })

        expect(result).toEqual(mockResponse)
      })

      it('should handle version not found error', async () => {
        const notFoundError = new Error('Version not found')
        ;(notFoundError as any).response = { status: 404 }
        mockAppcircleApi.delete.mockRejectedValue(notFoundError)

        await expect(removeEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'nonexistent'
        })).rejects.toThrow('Version not found')
      })

      it('should handle permission errors', async () => {
        const permissionError = new Error('Insufficient permissions to delete version')
        ;(permissionError as any).response = { status: 403 }
        mockAppcircleApi.delete.mockRejectedValue(permissionError)

        await expect(removeEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })).rejects.toThrow('Insufficient permissions')
      })

      it('should handle version in use error', async () => {
        const inUseError = new Error('Cannot delete version that is currently published')
        ;(inUseError as any).response = { status: 409 }
        mockAppcircleApi.delete.mockRejectedValue(inUseError)

        await expect(removeEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })).rejects.toThrow('Cannot delete version that is currently published')
      })

      it('should handle server errors during deletion', async () => {
        const serverError = new Error('Internal server error')
        ;(serverError as any).response = { status: 500 }
        mockAppcircleApi.delete.mockRejectedValue(serverError)

        await expect(removeEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })).rejects.toThrow('Internal server error')
      })

      it('should handle null response data - documents runtime error', async () => {
        mockAppcircleApi.delete.mockResolvedValue({ data: null })

        // This will throw a runtime error due to the buggy .length check
        await expect(removeEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })).rejects.toThrow("Cannot read properties of null (reading 'length')")
      })
    })
  })

  describe('File Upload with FormData', () => {
    describe('uploadEnterpriseAppVersion', () => {
      it('should upload app to specific profile', async () => {
        const mockUploadResponse = { success: true, versionId: 'v123' }
        mockFs.createReadStream.mockReturnValue('stream' as any)
        mockAppcircleApi.post.mockResolvedValue({ data: mockUploadResponse })

        const result = await uploadEnterpriseAppVersion({
          entProfileId: 'profile123',
          app: '/path/to/app.ipa'
        })

        expect(mockFs.createReadStream).toHaveBeenCalledWith('/path/to/app.ipa')
        expect(MockFormData.prototype.append).toHaveBeenCalledWith('File', 'stream')
        
        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'store/v2/profiles/profile123/app-versions',
          expect.any(FormData),
          expect.objectContaining({
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: expect.objectContaining({
              'Content-Type': 'multipart/form-data;boundary=test-boundary'
            })
          })
        )
        expect(result).toEqual(mockUploadResponse)
      })

      it('should handle file not found error', async () => {
        const fileError = new Error('ENOENT: no such file or directory')
        mockFs.createReadStream.mockImplementation(() => { throw fileError })

        await expect(uploadEnterpriseAppVersion({
          entProfileId: 'profile123',
          app: '/nonexistent/app.ipa'
        })).rejects.toThrow('ENOENT')
      })

      it('should handle permission errors on file access', async () => {
        const permError = new Error('EACCES: permission denied')
        mockFs.createReadStream.mockImplementation(() => { throw permError })

        await expect(uploadEnterpriseAppVersion({
          entProfileId: 'profile123',
          app: '/restricted/app.ipa'
        })).rejects.toThrow('EACCES')
      })

      it('should handle upload network errors', async () => {
        mockFs.createReadStream.mockReturnValue('stream' as any)
        const networkError = new Error('Network error during upload')
        mockAppcircleApi.post.mockRejectedValue(networkError)

        await expect(uploadEnterpriseAppVersion({
          entProfileId: 'profile123',
          app: '/path/to/app.ipa'
        })).rejects.toThrow('Network error during upload')
      })

      it('should handle large file upload with proper headers', async () => {
        mockFs.createReadStream.mockReturnValue('large-stream' as any)
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        await uploadEnterpriseAppVersion({
          entProfileId: 'profile123',
          app: '/path/to/large-app.ipa'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(FormData),
          expect.objectContaining({
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          })
        )
      })

      it('should merge headers correctly for multipart uploads', async () => {
        mockFs.createReadStream.mockReturnValue('stream' as any)
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        await uploadEnterpriseAppVersion({
          entProfileId: 'profile123',
          app: '/path/to/app.ipa'
        })

        expect(mockGetHeaders).toHaveBeenCalled()
        expect(MockFormData.prototype.getHeaders).toHaveBeenCalled()
        expect(MockFormData.prototype.getBoundary).toHaveBeenCalled()
      })
    })

    describe('uploadEnterpriseApp', () => {
      it('should upload app to create new profile', async () => {
        const mockUploadResponse = { success: true, profileId: 'newprofile123' }
        mockFs.createReadStream.mockReturnValue('stream' as any)
        mockAppcircleApi.post.mockResolvedValue({ data: mockUploadResponse })

        const result = await uploadEnterpriseApp({
          app: '/path/to/app.ipa'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'store/v2/profiles/app-versions', // No profile ID in URL
          expect.any(FormData),
          expect.objectContaining({
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          })
        )
        expect(result).toEqual(mockUploadResponse)
      })

      it('should handle large file upload timeout', async () => {
        const timeoutError = new Error('timeout of 300000ms exceeded')
        mockFs.createReadStream.mockReturnValue('large-stream' as any)
        mockAppcircleApi.post.mockRejectedValue(timeoutError)

        await expect(uploadEnterpriseApp({
          app: '/path/to/large-app.ipa'
        })).rejects.toThrow(/timeout/)
      })

      it('should handle disk space errors', async () => {
        mockFs.createReadStream.mockReturnValue('stream' as any)
        const diskError = new Error('ENOSPC: no space left on device')
        mockAppcircleApi.post.mockRejectedValue(diskError)

        await expect(uploadEnterpriseApp({
          app: '/path/to/app.ipa'
        })).rejects.toThrow('ENOSPC')
      })

      it('should handle FormData creation errors', async () => {
        mockFs.createReadStream.mockReturnValue('stream' as any)
        ;(MockFormData.prototype.append as any).mockImplementation(() => {
          throw new Error('FormData append failed')
        })

        await expect(uploadEnterpriseApp({
          app: '/path/to/app.ipa'
        })).rejects.toThrow('FormData append failed')
      })

      it('should handle empty file path', async () => {
        const emptyPathError = new Error('Path cannot be empty')
        mockFs.createReadStream.mockImplementation(() => { throw emptyPathError })

        await expect(uploadEnterpriseApp({
          app: ''
        })).rejects.toThrow('Path cannot be empty')
      })

      it('should handle special characters in file path', async () => {
        const specialPath = '/path/with spaces & symbols/app (v2.0).ipa'
        mockFs.createReadStream.mockReturnValue('stream' as any)
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        await uploadEnterpriseApp({
          app: specialPath
        })

        expect(mockFs.createReadStream).toHaveBeenCalledWith(specialPath)
      })
    })
  })

  describe('Notification System', () => {
    describe('notifyEnterpriseAppVersion', () => {
      it('should send notification with subject and message', async () => {
        const mockResponse = { success: true, notificationId: 'notif123' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await notifyEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456',
          subject: 'New Version Available',
          message: 'A new version of the app has been released with bug fixes.'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'store/v2/profiles/profile123/app-versions/version456?action=notify',
          {
            subject: 'New Version Available',
            message: 'A new version of the app has been released with bug fixes.'
          },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle empty subject and message', async () => {
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        await notifyEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456',
          subject: '',
          message: ''
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.any(String),
          { subject: '', message: '' },
          expect.any(Object)
        )
      })

      it('should handle HTML content in message', async () => {
        const htmlMessage = '<b>Important:</b> Please update to <a href="#">latest version</a>'
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        await notifyEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456',
          subject: 'HTML Notification',
          message: htmlMessage
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ message: htmlMessage }),
          expect.any(Object)
        )
      })

      it('should handle notification send failure', async () => {
        const sendError = new Error('Failed to send notification')
        ;(sendError as any).response = { status: 500 }
        mockAppcircleApi.post.mockRejectedValue(sendError)

        await expect(notifyEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456',
          subject: 'Test',
          message: 'Test message'
        })).rejects.toThrow('Failed to send notification')
      })

      it('should handle Unicode in notification content', async () => {
        const unicodeSubject = 'Yeni Sürüm Mevcut 🚀'
        const unicodeMessage = 'Uygulama güncellenmiştir. Lütfen indirin.'
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        await notifyEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456',
          subject: unicodeSubject,
          message: unicodeMessage
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.any(String),
          {
            subject: unicodeSubject,
            message: unicodeMessage
          },
          expect.any(Object)
        )
      })

      it('should handle notification rate limiting', async () => {
        const rateLimitError = new Error('Too many notifications sent')
        ;(rateLimitError as any).response = { status: 429 }
        mockAppcircleApi.post.mockRejectedValue(rateLimitError)

        await expect(notifyEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456',
          subject: 'Test',
          message: 'Test message'
        })).rejects.toThrow('Too many notifications sent')
      })

      it('should handle invalid version for notification', async () => {
        const invalidError = new Error('Cannot notify unpublished version')
        ;(invalidError as any).response = { status: 400 }
        mockAppcircleApi.post.mockRejectedValue(invalidError)

        await expect(notifyEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'unpublished_version',
          subject: 'Test',
          message: 'Test message'
        })).rejects.toThrow('Cannot notify unpublished version')
      })

      it('should handle very long message content', async () => {
        const longMessage = 'x'.repeat(10000) // Very long message
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        await notifyEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456',
          subject: 'Test',
          message: longMessage
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ message: longMessage }),
          expect.any(Object)
        )
      })
    })
  })

  describe('Download Link Generation', () => {
    describe('getEnterpriseDownloadLink', () => {
      it('should get download link for app version', async () => {
        const mockDownloadData = {
          downloadUrl: 'https://enterprise.example.com/download/app.ipa',
          qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
          expiresAt: '2024-12-31T23:59:59Z'
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockDownloadData })

        const result = await getEnterpriseDownloadLink({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'store/v2/profiles/profile123/app-versions/version456?action=download',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockDownloadData)
      })

      it('should handle expired download links', async () => {
        const expiredError = new Error('Download link expired')
        ;(expiredError as any).response = { status: 410 }
        mockAppcircleApi.get.mockRejectedValue(expiredError)

        await expect(getEnterpriseDownloadLink({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })).rejects.toThrow('Download link expired')
      })

      it('should handle version not published error', async () => {
        const notPublishedError = new Error('Version not published')
        ;(notPublishedError as any).response = { status: 400 }
        mockAppcircleApi.get.mockRejectedValue(notPublishedError)

        await expect(getEnterpriseDownloadLink({
          entProfileId: 'profile123',
          entVersionId: 'unpublished_version'
        })).rejects.toThrow('Version not published')
      })

      it('should handle download link generation failure', async () => {
        const generationError = new Error('Failed to generate download link')
        ;(generationError as any).response = { status: 500 }
        mockAppcircleApi.get.mockRejectedValue(generationError)

        await expect(getEnterpriseDownloadLink({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })).rejects.toThrow('Failed to generate download link')
      })

      it('should handle missing QR code in response', async () => {
        const mockDownloadData = {
          downloadUrl: 'https://enterprise.example.com/download/app.ipa'
          // qrCode: missing
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockDownloadData })

        const result = await getEnterpriseDownloadLink({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })

        expect(result).toEqual(mockDownloadData)
        expect(result.qrCode).toBeUndefined()
      })

      it('should handle version not found error', async () => {
        const notFoundError = new Error('Version not found')
        ;(notFoundError as any).response = { status: 404 }
        mockAppcircleApi.get.mockRejectedValue(notFoundError)

        await expect(getEnterpriseDownloadLink({
          entProfileId: 'profile123',
          entVersionId: 'nonexistent'
        })).rejects.toThrow('Version not found')
      })

      it('should handle profile access permissions', async () => {
        const permError = new Error('No access to profile')
        ;(permError as any).response = { status: 403 }
        mockAppcircleApi.get.mockRejectedValue(permError)

        await expect(getEnterpriseDownloadLink({
          entProfileId: 'restricted_profile',
          entVersionId: 'version456'
        })).rejects.toThrow('No access to profile')
      })
    })
  })

  describe('Critical Edge Cases and Performance', () => {
    describe('API Version Inconsistencies', () => {
      it('should document v1 vs v2 endpoint inconsistencies', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: {} })
        mockAppcircleApi.post.mockResolvedValue({ data: {} })

        // v1 endpoints
        await getEnterpriseUploadInformation({ fileSize: 1024, fileName: 'test.ipa' })
        await commitEnterpriseFileUpload({ fileId: 123, fileName: 'test.ipa' })

        // v2 endpoints
        await getEnterpriseProfiles()
        await getEnterpriseAppVersions({ entProfileId: 'profile123', publishType: '1' })

        const v1Calls = mockAppcircleApi.get.mock.calls
          .concat(mockAppcircleApi.post.mock.calls)
          .filter((call: any) => call[0].includes('store/v1/'))
        
        const v2Calls = mockAppcircleApi.get.mock.calls
          .concat(mockAppcircleApi.post.mock.calls)
          .filter((call: any) => call[0].includes('store/v2/'))

        expect(v1Calls.length).toBeGreaterThan(0)
        expect(v2Calls.length).toBeGreaterThan(0)
        
        // This documents the inconsistency - consider standardizing to v2
      })

      it('should show upload operations use different API versions', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: { uploadUrl: 'test' } })
        mockFs.createReadStream.mockReturnValue('stream' as any)
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        // Upload info uses v1
        await getEnterpriseUploadInformation({ fileSize: 1024, fileName: 'test.ipa' })
        
        // Actual upload uses v2
        await uploadEnterpriseApp({ app: '/path/test.ipa' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          expect.stringContaining('store/v1/'),
          expect.any(Object)
        )
        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.stringContaining('store/v2/'),
          expect.any(FormData),
          expect.any(Object)
        )
      })
    })

    describe('Concurrent Operations', () => {
      it('should handle concurrent file uploads', async () => {
        mockFs.createReadStream.mockReturnValue('stream' as any)
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        const uploads = Array(3).fill(0).map((_, i) => 
          uploadEnterpriseAppVersion({
            entProfileId: `profile${i}`,
            app: `/path/app${i}.ipa`
          })
        )

        const results = await Promise.all(uploads)

        expect(results).toHaveLength(3)
        results.forEach(result => expect(result.success).toBe(true))
        expect(mockAppcircleApi.post).toHaveBeenCalledTimes(3)
      })

      it('should handle concurrent notifications', async () => {
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        const notifications = Array(5).fill(0).map((_, i) =>
          notifyEnterpriseAppVersion({
            entProfileId: 'profile123',
            entVersionId: `version${i}`,
            subject: `Notification ${i}`,
            message: `Message ${i}`
          })
        )

        const results = await Promise.all(notifications)

        expect(results).toHaveLength(5)
        results.forEach(result => expect(result.success).toBe(true))
      })

      it('should handle concurrent publish operations', async () => {
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        const publishes = Array(3).fill(0).map((_, i) =>
          publishEnterpriseAppVersion({
            entProfileId: 'profile123',
            entVersionId: `version${i}`,
            summary: `Release ${i}`,
            releaseNotes: `Notes ${i}`,
            publishType: '1'
          })
        )

        const results = await Promise.all(publishes)

        expect(results).toHaveLength(3)
        results.forEach(result => expect(result.success).toBe(true))
      })
    })

    describe('Parameter Edge Cases', () => {
      it('should handle undefined parameters', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })

        await getEnterpriseAppVersions({
          entProfileId: undefined as any,
          publishType: '1'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          expect.stringContaining('store/v2/profiles/undefined/'),
          expect.any(Object)
        )
      })

      it('should handle null values in URL construction', async () => {
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        await commitEnterpriseFileUpload({
          fileId: 123,
          fileName: 'app.ipa',
          entProfileId: null as any
        })

        // Should handle null gracefully, but createNewProfile=false because null !== undefined
        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.stringContaining('createNewProfile=false'),
          expect.any(Object),
          expect.any(Object)
        )
      })

      it('should handle FormData boundary conflicts', async () => {
        mockFs.createReadStream.mockReturnValue('stream' as any)
        MockFormData.prototype.getBoundary = vi.fn(() => 'conflicting-boundary')
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

        await uploadEnterpriseApp({ app: '/path/app.ipa' })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(FormData),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'multipart/form-data;boundary=conflicting-boundary'
            })
          })
        )
      })
    })

    describe('Performance and Memory', () => {
      it('should handle memory pressure during large file operations', async () => {
        const memoryError = new Error('JavaScript heap out of memory')
        mockFs.createReadStream.mockImplementation(() => { throw memoryError })

        await expect(uploadEnterpriseApp({
          app: '/path/to/huge-file.ipa'
        })).rejects.toThrow(/memory/)
      })

      it('should handle network timeouts during upload', async () => {
        mockFs.createReadStream.mockReturnValue('stream' as any)
        const timeoutError = new Error('timeout of 300000ms exceeded')
        mockAppcircleApi.post.mockRejectedValue(timeoutError)

        await expect(uploadEnterpriseAppVersion({
          entProfileId: 'profile123',
          app: '/path/large-app.ipa'
        })).rejects.toThrow(/timeout/)
      })

      it('should handle rate limiting during concurrent operations', async () => {
        const rateLimitError = new Error('Too Many Requests')
        ;(rateLimitError as any).response = { status: 429 }
        
        mockAppcircleApi.get.mockRejectedValue(rateLimitError)

        await expect(getEnterpriseProfiles())
          .rejects.toThrow('Too Many Requests')
      })

      it('should handle disk space errors during large uploads', async () => {
        mockFs.createReadStream.mockReturnValue('stream' as any)
        const diskError = new Error('ENOSPC: no space left on device')
        mockAppcircleApi.post.mockRejectedValue(diskError)

        await expect(uploadEnterpriseApp({
          app: '/path/large-app.ipa'
        })).rejects.toThrow('ENOSPC')
      })
    })

    describe('Source Code Issues Documentation', () => {
      it('should document the switch statement bug in getEnterpriseAppVersions', async () => {
        // Actually, there's no bug - the switch statement works correctly
        const mockVersions = []
        mockAppcircleApi.get.mockResolvedValue({ data: mockVersions })

        await getEnterpriseAppVersions({
          entProfileId: 'profile123',
          publishType: '2'
        })

        // Switch statement works correctly - adds ?publishtype=Live
        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'store/v2/profiles/profile123/app-versions?publishtype=Live',
          expect.any(Object)
        )
      })

      it('should document the buggy length check in removeEnterpriseAppVersion', async () => {
        // This test documents the incorrect .length check on delete response
        const nonArrayResponse = { success: true, message: 'Deleted' }
        mockAppcircleApi.delete.mockResolvedValue({ data: nonArrayResponse })

        const result = await removeEnterpriseAppVersion({
          entProfileId: 'profile123',
          entVersionId: 'version456'
        })

        // The function checks if (versionResponse.data.length === 0)
        // But objects don't have .length, so it's undefined
        // undefined === 0 is false, so function returns the data
        expect(result).toEqual(nonArrayResponse)
        
        // TODO: Fix the length check - should validate response structure properly
      })

      it('should document parameter type inconsistency', () => {
        // getEnterpriseAppVersions doesn't use OptionsType<> while others do
        // This creates inconsistency in the API
        
        // Other functions use OptionsType:
        expect(typeof getEnterpriseUploadInformation).toBe('function')
        expect(typeof commitEnterpriseFileUpload).toBe('function')
        
        // This function doesn't use OptionsType:
        expect(typeof getEnterpriseAppVersions).toBe('function')
        
        // TODO: Standardize parameter types across all functions
      })

      it('should document lack of input validation', async () => {
        // No validation for file paths, IDs, sizes etc.
        mockAppcircleApi.get.mockResolvedValue({ data: [] })
        
        // These should validate but currently don't
        await getEnterpriseAppVersions({
          entProfileId: '', // Empty
          publishType: 'invalid' // Invalid
        })
        
        await getEnterpriseUploadInformation({
          fileSize: -1, // Negative
          fileName: '' // Empty
        })
        
        // Functions execute without validation
        expect(mockAppcircleApi.get).toHaveBeenCalledTimes(2)
        
        // TODO: Add input validation to all functions
      })
    })

    describe('Headers and Authentication', () => {
      it('should include proper headers in all requests', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })
        mockAppcircleApi.post.mockResolvedValue({ data: {} })
        mockAppcircleApi.patch.mockResolvedValue({ data: {} })
        mockAppcircleApi.delete.mockResolvedValue({ data: {} })

        await getEnterpriseProfiles()
        await commitEnterpriseFileUpload({ fileId: 123, fileName: 'test.ipa' })

        // Verify all calls include headers
        const allCalls = [
          ...mockAppcircleApi.get.mock.calls,
          ...mockAppcircleApi.post.mock.calls,
          ...mockAppcircleApi.patch.mock.calls,
          ...mockAppcircleApi.delete.mock.calls
        ].filter(call => !(call[1] instanceof FormData)) // Exclude multipart calls

        allCalls.forEach((call: any) => {
          const config = call[call.length - 1]
          expect(config.headers).toEqual(expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }))
        })
      })

      it('should call getHeaders for all API requests', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })

        await getEnterpriseProfiles()

        expect(mockGetHeaders).toHaveBeenCalled()
      })

      it('should merge headers correctly for multipart uploads', async () => {
        mockFs.createReadStream.mockReturnValue('stream' as any)
        mockAppcircleApi.post.mockResolvedValue({ data: {} })

        await uploadEnterpriseApp({ app: '/path/app.ipa' })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(FormData),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-token',
              'Content-Type': expect.stringContaining('multipart/form-data')
            })
          })
        )
      })
    })
  })
})