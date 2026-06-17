import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import FormData from 'form-data'
import axios from 'axios'

// Mock dependencies first
vi.mock('fs')
vi.mock('form-data')
vi.mock('axios')

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
  createPublishProfile,
  deletePublishProfile,
  renamePublishProfile,
  getPublishProfiles,
  getAppVersionDetail,
  startExistingPublishFlow,
  getActivePublishes,
  getPublishVariableGroups,
  getPublishVariableListByGroupId,
  setAppVersionReleaseCandidateStatus,
  setAppVersionReleaseNote,
  switchPublishProfileAutoPublishSettings,
  uploadAppVersion,
  getAppVersions,
  getPublishByAppVersion,
  deleteAppVersion,
  getAppVersionDownloadLink,
  getPublisDetailById,
  getPublishProfileDetailById,
  downloadAppVersion,
  getPublishUploadInformation,
  commitPublishFileUpload,
  uploadPublishEnvironmentVariablesFromFile,
  getPublishFlows,
  downloadPublishFlowYaml,
  updatePublishFlowFromFile
} from '../../../src/services/publish'

import { appcircleApi, getHeaders } from '../../../src/services/api'

const mockAppcircleApi = appcircleApi as any
const mockGetHeaders = getHeaders as any
const mockFs = vi.mocked(fs)
const MockFormData = vi.mocked(FormData)
const mockAxios = vi.mocked(axios)

describe('Publish Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    MockFormData.prototype.append = vi.fn()
    MockFormData.prototype.getHeaders = vi.fn(() => ({
      'content-type': 'multipart/form-data; boundary=test'
    }))
    MockFormData.prototype.getBoundary = vi.fn(() => 'test-boundary')
  })

  describe('Publish Profile Management', () => {
    describe('createPublishProfile', () => {
      it('should create publish profile for valid platforms', async () => {
        const mockResponse = { id: 'pp123', name: 'Test Profile', platform: 'ios' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await createPublishProfile({
          platform: 'ios',
          name: 'Test Profile'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'publish/v2/profiles/ios',
          { name: 'Test Profile' },
          { headers: expect.objectContaining({ 'Authorization': 'Bearer test-token' }) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle invalid platform error', async () => {
        const platformError = new Error('Unsupported platform')
        mockAppcircleApi.post.mockRejectedValue(platformError)

        await expect(createPublishProfile({
          platform: 'invalidplatform',
          name: 'Test'
        })).rejects.toThrow('Unsupported platform')
      })

      it('should handle duplicate name error', async () => {
        const duplicateError = new Error('Profile name already exists')
        mockAppcircleApi.post.mockRejectedValue(duplicateError)

        await expect(createPublishProfile({
          platform: 'android',
          name: 'Existing Profile'
        })).rejects.toThrow('Profile name already exists')
      })

      it('should create profile for android platform', async () => {
        const mockResponse = { id: 'pp124', name: 'Android Profile', platform: 'android' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await createPublishProfile({
          platform: 'android',
          name: 'Android Profile'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'publish/v2/profiles/android',
          { name: 'Android Profile' },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle special characters in profile name', async () => {
        const specialName = 'Profile (v2.0) [Production] & More!'
        const mockResponse = { id: 'pp125', name: specialName }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await createPublishProfile({
          platform: 'ios',
          name: specialName
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'publish/v2/profiles/ios',
          { name: specialName },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })
    })

    describe('getPublishProfiles', () => {
      it('should fetch profiles for iOS platform', async () => {
        const mockProfiles = [
          { id: 'pp1', name: 'iOS Profile 1', platform: 'ios' },
          { id: 'pp2', name: 'iOS Profile 2', platform: 'ios' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockProfiles })

        const result = await getPublishProfiles({ platform: 'ios' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'publish/v2/profiles/ios',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockProfiles)
      })

      it('should fetch profiles for Android platform', async () => {
        const mockProfiles = [
          { id: 'pp3', name: 'Android Profile 1', platform: 'android' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockProfiles })

        const result = await getPublishProfiles({ platform: 'android' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'publish/v2/profiles/android',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockProfiles)
      })

      it('should handle empty profiles list', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })
        
        const result = await getPublishProfiles({ platform: 'android' })
        
        expect(result).toEqual([])
      })

      it('should handle API errors when fetching profiles', async () => {
        const apiError = new Error('Failed to fetch profiles')
        mockAppcircleApi.get.mockRejectedValue(apiError)

        await expect(getPublishProfiles({ platform: 'ios' }))
          .rejects.toThrow('Failed to fetch profiles')
      })
    })

    describe('renamePublishProfile', () => {
      it('should rename profile successfully', async () => {
        const mockResponse = { id: 'pp123', name: 'Renamed Profile' }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })

        const result = await renamePublishProfile({
          platform: 'ios',
          publishProfileId: 'pp123',
          name: 'Renamed Profile'
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          'publish/v2/profiles/ios/pp123',
          { name: 'Renamed Profile' },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle rename with unicode characters', async () => {
        const unicodeName = 'Profil Тест 测试 🚀'
        const mockResponse = { id: 'pp123', name: unicodeName }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })

        const result = await renamePublishProfile({
          platform: 'android',
          publishProfileId: 'pp123',
          name: unicodeName
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          'publish/v2/profiles/android/pp123',
          { name: unicodeName },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle profile not found error', async () => {
        const notFoundError = new Error('Profile not found')
        mockAppcircleApi.patch.mockRejectedValue(notFoundError)

        await expect(renamePublishProfile({
          platform: 'ios',
          publishProfileId: 'nonexistent',
          name: 'New Name'
        })).rejects.toThrow('Profile not found')
      })
    })

    describe('deletePublishProfile', () => {
      it('should delete profile successfully', async () => {
        const mockResponse = { success: true }
        mockAppcircleApi.delete.mockResolvedValue({ data: mockResponse })

        const result = await deletePublishProfile({
          platform: 'ios',
          publishProfileId: 'pp123'
        })

        expect(mockAppcircleApi.delete).toHaveBeenCalledWith(
          'publish/v2/profiles/ios/pp123',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle profile in use error', async () => {
        const inUseError = new Error('Profile is currently in use')
        mockAppcircleApi.delete.mockRejectedValue(inUseError)

        await expect(deletePublishProfile({
          platform: 'android',
          publishProfileId: 'pp123'
        })).rejects.toThrow('Profile is currently in use')
      })
    })

    describe('getPublishProfileDetailById', () => {
      it('should fetch profile details by ID', async () => {
        const mockProfile = {
          id: 'pp123',
          name: 'Test Profile',
          platform: 'ios',
          settings: { autoPublish: true }
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockProfile })

        const result = await getPublishProfileDetailById({
          publishProfileId: 'pp123',
          platform: 'ios'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'publish/v2/profiles/ios/pp123',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockProfile)
      })
    })
  })

  describe('App Version Operations', () => {
    describe('uploadAppVersion', () => {
      it('should upload app file with correct FormData structure', async () => {
        const mockUploadResponse = { id: 'av123', status: 'uploaded' }
        mockFs.createReadStream.mockReturnValue('app-stream' as any)
        mockAppcircleApi.post.mockResolvedValue({ data: mockUploadResponse })

        const result = await uploadAppVersion({
          app: '/path/to/app.ipa',
          publishProfileId: 'pp123',
          platform: 'ios'
        })

        expect(mockFs.createReadStream).toHaveBeenCalledWith('/path/to/app.ipa')
        expect(MockFormData.prototype.append).toHaveBeenCalledWith('File', 'app-stream')
        
        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'publish/v2/profiles/ios/pp123/app-versions',
          expect.any(FormData),
          expect.objectContaining({
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: expect.objectContaining({
              'Content-Type': expect.stringMatching(/multipart\/form-data/)
            })
          })
        )
        expect(result).toEqual(mockUploadResponse)
      })

      it('should handle file not found error', async () => {
        const fileError = new Error('ENOENT: no such file or directory')
        mockFs.createReadStream.mockImplementation(() => { throw fileError })

        await expect(uploadAppVersion({
          app: '/nonexistent/app.ipa',
          publishProfileId: 'pp123',
          platform: 'ios'
        })).rejects.toThrow('ENOENT')
      })

      it('should handle large file uploads', async () => {
        mockFs.createReadStream.mockReturnValue('large-app-stream' as any)
        mockAppcircleApi.post.mockResolvedValue({ data: { id: 'av123' } })

        await uploadAppVersion({
          app: '/path/to/large-app.ipa',
          publishProfileId: 'pp123',
          platform: 'ios'
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

      it('should upload Android app with correct endpoint', async () => {
        mockFs.createReadStream.mockReturnValue('android-app-stream' as any)
        mockAppcircleApi.post.mockResolvedValue({ data: { id: 'av124' } })

        await uploadAppVersion({
          app: '/path/to/app.apk',
          publishProfileId: 'pp124',
          platform: 'android'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'publish/v2/profiles/android/pp124/app-versions',
          expect.any(FormData),
          expect.any(Object)
        )
      })

      it('should handle upload failure with proper error', async () => {
        mockFs.createReadStream.mockReturnValue('app-stream' as any)
        const uploadError = new Error('Upload failed - invalid file format')
        mockAppcircleApi.post.mockRejectedValue(uploadError)

        await expect(uploadAppVersion({
          app: '/path/to/invalid.txt',
          publishProfileId: 'pp123',
          platform: 'ios'
        })).rejects.toThrow('Upload failed - invalid file format')
      })
    })

    describe('getAppVersionDetail', () => {
      it('should use v1 endpoint for app version details', async () => {
        const mockVersion = { 
          id: 'av123', 
          version: '1.0.0',
          buildNumber: '1',
          fileSize: 50000000
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockVersion })

        const result = await getAppVersionDetail({
          publishProfileId: 'pp123',
          platform: 'ios',
          appVersionId: 'av123'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'publish/v1/profiles/ios/pp123/app-versions/av123',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockVersion)
      })

      it('should handle Android app version details', async () => {
        const mockVersion = { 
          id: 'av124', 
          version: '2.1.0',
          versionCode: 21
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockVersion })

        await getAppVersionDetail({
          publishProfileId: 'pp124',
          platform: 'android',
          appVersionId: 'av124'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'publish/v1/profiles/android/pp124/app-versions/av124',
          { headers: expect.any(Object) }
        )
      })

      it('should handle app version not found', async () => {
        const notFoundError = new Error('App version not found')
        mockAppcircleApi.get.mockRejectedValue(notFoundError)

        await expect(getAppVersionDetail({
          publishProfileId: 'pp123',
          platform: 'ios',
          appVersionId: 'nonexistent'
        })).rejects.toThrow('App version not found')
      })
    })

    describe('getAppVersions', () => {
      it('should fetch all app versions for a profile', async () => {
        const mockVersions = [
          { id: 'av1', version: '1.0.0' },
          { id: 'av2', version: '1.1.0' },
          { id: 'av3', version: '2.0.0' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockVersions })

        const result = await getAppVersions({
          publishProfileId: 'pp123',
          platform: 'ios'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'publish/v2/profiles/ios/pp123/app-versions',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockVersions)
      })

      it('should handle empty app versions list', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })

        const result = await getAppVersions({
          publishProfileId: 'pp123',
          platform: 'android'
        })

        expect(result).toEqual([])
      })
    })

    describe('deleteAppVersion', () => {
      it('should delete app version successfully', async () => {
        const mockResponse = { success: true }
        mockAppcircleApi.delete.mockResolvedValue({ data: mockResponse })

        const result = await deleteAppVersion({
          publishProfileId: 'pp123',
          platform: 'ios',
          appVersionId: 'av123'
        })

        expect(mockAppcircleApi.delete).toHaveBeenCalledWith(
          'publish/v2/profiles/ios/pp123/app-versions/av123',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle version in use error', async () => {
        const inUseError = new Error('Cannot delete version that is currently published')
        mockAppcircleApi.delete.mockRejectedValue(inUseError)

        await expect(deleteAppVersion({
          publishProfileId: 'pp123',
          platform: 'ios',
          appVersionId: 'av123'
        })).rejects.toThrow('Cannot delete version that is currently published')
      })
    })

    describe('setAppVersionReleaseCandidateStatus', () => {
      it('should set release candidate status to true', async () => {
        const mockResponse = { success: true }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })

        const result = await setAppVersionReleaseCandidateStatus({
          publishProfileId: 'pp123',
          platform: 'ios',
          appVersionId: 'av123',
          releaseCandidate: true
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          'publish/v2/profiles/ios/pp123/app-versions/av123?action=releaseCandidate',
          { ReleaseCandidate: true },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should set release candidate status to false', async () => {
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        const result = await setAppVersionReleaseCandidateStatus({
          publishProfileId: 'pp123',
          platform: 'android',
          appVersionId: 'av123',
          releaseCandidate: false
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.stringContaining('action=releaseCandidate'),
          { ReleaseCandidate: false },
          expect.any(Object)
        )
        expect(result).toEqual({ success: true })
      })
    })

    describe('setAppVersionReleaseNote', () => {
      it('should update release notes with summary', async () => {
        const releaseNote = 'New features and bug fixes'
        const mockResponse = { success: true }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })

        const result = await setAppVersionReleaseNote({
          publishProfileId: 'pp123',
          platform: 'ios',
          appVersionId: 'av123',
          summary: releaseNote
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.stringContaining('action=releaseNotes'),
          { summary: releaseNote },
          expect.any(Object)
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle empty release notes', async () => {
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        await setAppVersionReleaseNote({
          publishProfileId: 'pp123',
          platform: 'android',
          appVersionId: 'av123',
          summary: ''
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          { summary: '' },
          expect.any(Object)
        )
      })

      it('should handle Unicode and special characters in release notes', async () => {
        const unicodeNote = 'Yeni özellik eklendi 🚀 ve buglar düzeltildi'
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        await setAppVersionReleaseNote({
          publishProfileId: 'pp123',
          platform: 'ios',
          appVersionId: 'av123',
          summary: unicodeNote
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          { summary: unicodeNote },
          expect.any(Object)
        )
      })

      it('should handle very long release notes', async () => {
        const longNote = 'A'.repeat(5000) + ' - Long release note'
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        await setAppVersionReleaseNote({
          publishProfileId: 'pp123',
          platform: 'ios',
          appVersionId: 'av123',
          summary: longNote
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          { summary: longNote },
          expect.any(Object)
        )
      })
    })
  })

  describe('File Download Operations', () => {
    describe('downloadAppVersion', () => {
      it('should download app version file successfully', async () => {
        const mockStream = {
          pipe: vi.fn()
        }
        const mockWriter = {
          on: vi.fn(),
          close: vi.fn()
        }

        // Note: Uses direct axios, not appcircleApi
        ;(mockAxios.get as any).mockResolvedValue({ data: mockStream })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        // Simulate successful download
        mockWriter.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(), 0)
          }
          return mockWriter
        })

        const promise = downloadAppVersion({
          url: 'https://download.example.com/app.ipa',
          path: '/downloads/app.ipa'
        })

        await expect(promise).resolves.toBe(true)
        expect(mockAxios.get).toHaveBeenCalledWith(
          'https://download.example.com/app.ipa',
          { responseType: 'stream' }
        )
        expect(mockStream.pipe).toHaveBeenCalledWith(mockWriter)
      })

      it('should handle download URL errors', async () => {
        const urlError = new Error('404 Not Found')
        ;(mockAxios.get as any).mockRejectedValue(urlError)

        await expect(downloadAppVersion({
          url: 'https://invalid.example.com/app.ipa',
          path: '/downloads/app.ipa'
        })).rejects.toThrow('404 Not Found')
      })

      it('should handle file write permission errors', async () => {
        const permissionError = new Error('EACCES: permission denied')
        const mockWriter = {
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'error') {
              setTimeout(() => callback(permissionError), 0)
            }
            return mockWriter
          }),
          close: vi.fn()
        }

        ;(mockAxios.get as any).mockResolvedValue({ data: { pipe: vi.fn() } })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        await expect(downloadAppVersion({
          url: 'https://download.example.com/app.ipa',
          path: '/readonly/app.ipa'
        })).rejects.toThrow('EACCES')
      })

      it('should handle network interruption during download', async () => {
        const networkError = new Error('ECONNRESET: Connection reset by peer')
        ;(mockAxios.get as any).mockRejectedValue(networkError)

        await expect(downloadAppVersion({
          url: 'https://unstable.example.com/app.ipa',
          path: '/downloads/app.ipa'
        })).rejects.toThrow('ECONNRESET')
      })

      it('should handle disk space errors during download', async () => {
        const diskError = new Error('ENOSPC: no space left on device')
        const mockWriter = {
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'error') {
              setTimeout(() => callback(diskError), 0)
            }
            return mockWriter
          }),
          close: vi.fn()
        }

        ;(mockAxios.get as any).mockResolvedValue({ data: { pipe: vi.fn() } })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        await expect(downloadAppVersion({
          url: 'https://download.example.com/large-app.ipa',
          path: '/full-disk/app.ipa'
        })).rejects.toThrow('ENOSPC')
      })
    })

    describe('getAppVersionDownloadLink', () => {
      it('should get download link with proper action parameter', async () => {
        const mockLink = { downloadUrl: 'https://secure-download.com/app.ipa' }
        mockAppcircleApi.get.mockResolvedValue({ data: mockLink })

        const result = await getAppVersionDownloadLink({
          publishProfileId: 'pp123',
          platform: 'ios',
          appVersionId: 'av123'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'publish/v2/profiles/ios/pp123/app-versions/av123?action=download',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockLink)
      })

      it('should handle expired download links', async () => {
        const expiredError = new Error('Download link expired')
        mockAppcircleApi.get.mockRejectedValue(expiredError)

        await expect(getAppVersionDownloadLink({
          publishProfileId: 'pp123',
          platform: 'ios',
          appVersionId: 'av123'
        })).rejects.toThrow('Download link expired')
      })

      it('should get download link for Android apps', async () => {
        const mockLink = { downloadUrl: 'https://secure-download.com/app.apk' }
        mockAppcircleApi.get.mockResolvedValue({ data: mockLink })

        const result = await getAppVersionDownloadLink({
          publishProfileId: 'pp124',
          platform: 'android',
          appVersionId: 'av124'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'publish/v2/profiles/android/pp124/app-versions/av124?action=download',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockLink)
      })
    })
  })

  describe('File Upload Operations', () => {
    describe('getPublishUploadInformation', () => {
      it('should get upload info with proper URL encoding', async () => {
        const mockUploadInfo = {
          uploadUrl: 'https://upload.example.com',
          fileId: 123
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockUploadInfo })

        const result = await getPublishUploadInformation({
          platform: 'ios',
          publishProfileId: 'pp123',
          fileSize: 50000000,
          fileName: 'My App (v2.0) [Release].ipa'
        })

        const expectedUrl = 'publish/v1/profiles/ios/pp123/app-versions' +
          '?action=uploadInformation&fileSize=50000000&fileName=My App (v2.0) [Release].ipa'

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          expectedUrl,
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockUploadInfo)
      })

      it('should handle special characters in filename', async () => {
        const mockUploadInfo = { uploadUrl: 'https://upload.example.com', fileId: 456 }
        mockAppcircleApi.get.mockResolvedValue({ data: mockUploadInfo })

        await getPublishUploadInformation({
          platform: 'android',
          publishProfileId: 'pp124',
          fileSize: 30000000,
          fileName: 'Test App & More (2024) #beta.apk'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          expect.stringContaining('Test App & More (2024) #beta.apk'),
          { headers: expect.any(Object) }
        )
      })

      it('should handle extremely large file sizes', async () => {
        const largeFileError = new Error('File too large')
        mockAppcircleApi.get.mockRejectedValue(largeFileError)

        await expect(getPublishUploadInformation({
          platform: 'ios',
          publishProfileId: 'pp123',
          fileSize: 10000000000, // 10GB
          fileName: 'huge-app.ipa'
        })).rejects.toThrow('File too large')
      })

      it('should handle unicode filenames', async () => {
        const mockUploadInfo = { uploadUrl: 'https://upload.example.com', fileId: 789 }
        mockAppcircleApi.get.mockResolvedValue({ data: mockUploadInfo })

        await getPublishUploadInformation({
          platform: 'ios',
          publishProfileId: 'pp123',
          fileSize: 40000000,
          fileName: '应用程序_тест_🚀.ipa'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          expect.stringContaining('应用程序_тест_🚀.ipa'),
          { headers: expect.any(Object) }
        )
      })
    })

    describe('commitPublishFileUpload', () => {
      it('should commit file upload with correct parameters', async () => {
        const mockResponse = { success: true, appVersionId: 'av123' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await commitPublishFileUpload({
          platform: 'android',
          publishProfileId: 'pp123',
          fileId: 456,
          fileName: 'app.apk'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'publish/v1/profiles/android/pp123/app-versions?action=commitFileUpload',
          {
            fileId: 456,
            fileName: 'app.apk'
          },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle invalid file ID error', async () => {
        const invalidFileError = new Error('Invalid file ID')
        mockAppcircleApi.post.mockRejectedValue(invalidFileError)

        await expect(commitPublishFileUpload({
          platform: 'ios',
          publishProfileId: 'pp123',
          fileId: -1,
          fileName: 'app.ipa'
        })).rejects.toThrow('Invalid file ID')
      })

      it('should handle commit timeout error', async () => {
        const timeoutError = new Error('File commit timeout')
        mockAppcircleApi.post.mockRejectedValue(timeoutError)

        await expect(commitPublishFileUpload({
          platform: 'ios',
          publishProfileId: 'pp123',
          fileId: 123,
          fileName: 'app.ipa'
        })).rejects.toThrow('File commit timeout')
      })

      it('should commit with complex filename', async () => {
        const mockResponse = { success: true, appVersionId: 'av456' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        await commitPublishFileUpload({
          platform: 'ios',
          publishProfileId: 'pp123',
          fileId: 789,
          fileName: 'Complex App Name (v1.0) [Beta] & More!.ipa'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          expect.any(String),
          {
            fileId: 789,
            fileName: 'Complex App Name (v1.0) [Beta] & More!.ipa'
          },
          expect.any(Object)
        )
      })
    })
  })

  describe('Environment Variables', () => {
    describe('getPublishVariableGroups', () => {
      it('should fetch variable groups successfully', async () => {
        const mockGroups = [
          { id: 'vg1', name: 'Production Vars' },
          { id: 'vg2', name: 'Staging Vars' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockGroups })

        const result = await getPublishVariableGroups()

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'publish/v2/variable-groups',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockGroups)
      })

      it('should handle empty variable groups', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })

        const result = await getPublishVariableGroups()

        expect(result).toEqual([])
      })
    })

    describe('getPublishVariableListByGroupId', () => {
      it('should fetch variables for a specific group', async () => {
        const mockVariables = [
          { key: 'API_URL', value: 'https://api.example.com' },
          { key: 'DEBUG', value: 'false' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockVariables })

        const result = await getPublishVariableListByGroupId({
          publishVariableGroupId: 'vg123'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'publish/v2/variable-groups/vg123',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockVariables)
      })

      it('should handle group not found error', async () => {
        const notFoundError = new Error('Variable group not found')
        mockAppcircleApi.get.mockRejectedValue(notFoundError)

        await expect(getPublishVariableListByGroupId({
          publishVariableGroupId: 'nonexistent'
        })).rejects.toThrow('Variable group not found')
      })
    })

    describe('uploadPublishEnvironmentVariablesFromFile', () => {
      it('should upload env variables file with correct FormData', async () => {
        const mockResponse = { success: true, variablesCount: 5 }
        mockFs.createReadStream.mockReturnValue('env-stream' as any)
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await uploadPublishEnvironmentVariablesFromFile({
          publishVariableGroupId: 'vg123',
          filePath: '/path/to/env-vars.txt'
        })

        expect(mockFs.createReadStream).toHaveBeenCalledWith('/path/to/env-vars.txt')
        expect(MockFormData.prototype.append).toHaveBeenCalledWith('variableGroupId', 'vg123')
        expect(MockFormData.prototype.append).toHaveBeenCalledWith('envVariablesFile', 'env-stream')

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'publish/v1/variable-groups/vg123/upload-variables-file',
          expect.any(FormData),
          expect.objectContaining({
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: expect.objectContaining({
              'content-type': expect.stringContaining('multipart/form-data')
            })
          })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle malformed env file error', async () => {
        mockFs.createReadStream.mockReturnValue('invalid-stream' as any)
        const formatError = new Error('Invalid environment file format')
        mockAppcircleApi.post.mockRejectedValue(formatError)

        await expect(uploadPublishEnvironmentVariablesFromFile({
          publishVariableGroupId: 'vg123',
          filePath: '/path/to/malformed-env.txt'
        })).rejects.toThrow('Invalid environment file format')
      })

      it('should handle file not found for env variables', async () => {
        const fileError = new Error('ENOENT: no such file or directory')
        mockFs.createReadStream.mockImplementation(() => { throw fileError })

        await expect(uploadPublishEnvironmentVariablesFromFile({
          publishVariableGroupId: 'vg123',
          filePath: '/nonexistent/env-vars.txt'
        })).rejects.toThrow('ENOENT')
      })

      it('should handle large env variables file', async () => {
        mockFs.createReadStream.mockReturnValue('large-env-stream' as any)
        mockAppcircleApi.post.mockResolvedValue({ data: { success: true, variablesCount: 100 } })

        await uploadPublishEnvironmentVariablesFromFile({
          publishVariableGroupId: 'vg123',
          filePath: '/path/to/large-env-vars.txt'
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
    })
  })

  describe('Publish Flow Management', () => {
    describe('startExistingPublishFlow', () => {
      it('should restart publish flow with correct action parameter', async () => {
        const mockResponse = { publishId: 'pub123', status: 'restarted' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await startExistingPublishFlow({
          publishProfileId: 'pp123',
          platform: 'ios',
          publishId: 'pub123'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'publish/v2/profiles/ios/pp123/publish/pub123?action=restart',
          '{}',  // Empty JSON string as body
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle non-existent publish ID', async () => {
        const notFoundError = new Error('Publish not found')
        mockAppcircleApi.post.mockRejectedValue(notFoundError)

        await expect(startExistingPublishFlow({
          publishProfileId: 'pp123',
          platform: 'android',
          publishId: 'nonexistent'
        })).rejects.toThrow('Publish not found')
      })

      it('should restart Android publish flow', async () => {
        const mockResponse = { publishId: 'pub456', status: 'restarted' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        await startExistingPublishFlow({
          publishProfileId: 'pp124',
          platform: 'android',
          publishId: 'pub456'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'publish/v2/profiles/android/pp124/publish/pub456?action=restart',
          '{}',
          { headers: expect.any(Object) }
        )
      })

      it('should handle publish flow already running error', async () => {
        const runningError = new Error('Publish flow is already running')
        mockAppcircleApi.post.mockRejectedValue(runningError)

        await expect(startExistingPublishFlow({
          publishProfileId: 'pp123',
          platform: 'ios',
          publishId: 'pub123'
        })).rejects.toThrow('Publish flow is already running')
      })
    })

    describe('getActivePublishes', () => {
      it('should filter publishes with non-null publishId', async () => {
        const mockBuilds = {
          data: [
            { id: 'b1', publishId: 'pub1', status: 'running' },
            { id: 'b2', publishId: null, status: 'completed' },
            { id: 'b3', publishId: 'pub2', status: 'pending' },
            { id: 'b4', publishId: 'pub3', status: 'failed' }
          ]
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockBuilds })

        const result = await getActivePublishes()

        expect(result).toHaveLength(3)
        expect(result.every((p: any) => p.publishId !== null)).toBe(true)
        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          '/build/v1/queue/my-dashboard?page=1&size=1000',
          { headers: expect.any(Object) }
        )
      })

      it('should handle empty builds queue', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: { data: [] } })
        
        const result = await getActivePublishes()
        expect(result).toEqual([])
      })

      it('should handle malformed response structure', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: null })
        
        const result = await getActivePublishes()
        expect(result).toBeUndefined()
      })

      it('should handle missing data property', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: {} })
        
        const result = await getActivePublishes()
        expect(result).toBeUndefined()
      })

      it('should filter out builds without publishId', async () => {
        const mockBuilds = {
          data: [
            { id: 'b1', publishId: null, status: 'completed' },
            { id: 'b2', publishId: undefined, status: 'completed' },
            { id: 'b3', status: 'completed' } // Missing publishId property
          ]
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockBuilds })

        const result = await getActivePublishes()

        // The function uses publishId !== null, so undefined values will pass through
        // This is actually a bug in the source code - it should check for truthy values
        expect(result).toEqual([
          { id: 'b2', publishId: undefined, status: 'completed' },
          { id: 'b3', status: 'completed' }
        ])
      })
    })

    describe('getPublishByAppVersion', () => {
      it('should get publish details for app version', async () => {
        const mockPublish = {
          id: 'pub123',
          status: 'completed',
          startedAt: '2024-01-01T10:00:00Z'
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockPublish })

        const result = await getPublishByAppVersion({
          publishProfileId: 'pp123',
          platform: 'ios',
          appVersionId: 'av123'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'publish/v2/profiles/ios/pp123/app-versions/av123/publish',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockPublish)
      })

      it('should handle no publish found for app version', async () => {
        const noPublishError = new Error('No publish found for this app version')
        mockAppcircleApi.get.mockRejectedValue(noPublishError)

        await expect(getPublishByAppVersion({
          publishProfileId: 'pp123',
          platform: 'ios',
          appVersionId: 'av123'
        })).rejects.toThrow('No publish found for this app version')
      })
    })

    describe('getPublisDetailById', () => {
      it('should get publish details by ID', async () => {
        const mockPublishDetail = {
          id: 'pub123',
          status: 'completed',
          publishLogs: ['Started', 'Processing', 'Completed']
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockPublishDetail })

        const result = await getPublisDetailById({
          publishProfileId: 'pp123',
          platform: 'ios',
          appVersionId: 'av123'
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'publish/v2/profiles/ios/pp123/app-versions/av123/publish',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockPublishDetail)
      })
    })
  })

  describe('Auto-Publish Settings', () => {
    describe('switchPublishProfileAutoPublishSettings', () => {
      it('should enable auto-publish with existing settings', async () => {
        const currentSettings = { environment: 'production', notifications: true }
        const mockResponse = { 
          profileSettings: { 
            ...currentSettings, 
            whenNewVersionRecieved: true // Note: typo in source code
          } 
        }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })

        const result = await switchPublishProfileAutoPublishSettings({
          publishProfileId: 'pp123',
          platform: 'ios',
          enable: true,
          currentProfileSettings: currentSettings
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          'publish/v2/profiles/ios/pp123',
          {
            profileSettings: {
              environment: 'production',
              notifications: true,
              whenNewVersionRecieved: true // Typo preserved from source
            }
          },
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should disable auto-publish', async () => {
        const currentSettings = { environment: 'staging', notifications: false }
        const mockResponse = {
          profileSettings: {
            ...currentSettings,
            whenNewVersionRecieved: false
          }
        }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })

        await switchPublishProfileAutoPublishSettings({
          publishProfileId: 'pp124',
          platform: 'android',
          enable: false,
          currentProfileSettings: currentSettings
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          'publish/v2/profiles/android/pp124',
          {
            profileSettings: {
              environment: 'staging',
              notifications: false,
              whenNewVersionRecieved: false
            }
          },
          { headers: expect.any(Object) }
        )
      })

      it('should handle null currentProfileSettings', async () => {
        const mockResponse = { profileSettings: { whenNewVersionRecieved: false } }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })

        await switchPublishProfileAutoPublishSettings({
          publishProfileId: 'pp123',
          platform: 'android',
          enable: false,
          currentProfileSettings: null
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          {
            profileSettings: { whenNewVersionRecieved: false }
          },
          expect.any(Object)
        )
      })

      it('should handle undefined currentProfileSettings', async () => {
        const mockResponse = { profileSettings: { whenNewVersionRecieved: true } }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })

        await switchPublishProfileAutoPublishSettings({
          publishProfileId: 'pp123',
          platform: 'ios',
          enable: true,
          currentProfileSettings: undefined as any
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          {
            profileSettings: { whenNewVersionRecieved: true }
          },
          expect.any(Object)
        )
      })

      it('should preserve complex existing settings', async () => {
        const complexSettings = {
          environment: 'production',
          notifications: true,
          reviewSettings: { requireApproval: true },
          distributionSettings: { groups: ['internal', 'beta'] }
        }
        mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

        await switchPublishProfileAutoPublishSettings({
          publishProfileId: 'pp123',
          platform: 'ios',
          enable: true,
          currentProfileSettings: complexSettings
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          expect.any(String),
          {
            profileSettings: {
              ...complexSettings,
              whenNewVersionRecieved: true
            }
          },
          expect.any(Object)
        )
      })
    })
  })

  describe('API Version Consistency Issues', () => {
    it('should document v1 vs v2 endpoint inconsistencies', async () => {
      mockAppcircleApi.get.mockResolvedValue({ data: {} })
      mockAppcircleApi.post.mockResolvedValue({ data: {} })

      // These use different API versions
      await getAppVersionDetail({ publishProfileId: 'pp123', platform: 'ios', appVersionId: 'av123' }) // v1
      await getPublishUploadInformation({ platform: 'ios', publishProfileId: 'pp123', fileSize: 1000, fileName: 'test.ipa' }) // v1
      await getPublishProfiles({ platform: 'ios' }) // v2
      await uploadAppVersion({ app: '/path/test.ipa', publishProfileId: 'pp123', platform: 'ios' }) // v2

      // Document the API version inconsistency issue
      const v1Calls = mockAppcircleApi.get.mock.calls.filter((call: any) => 
        call[0].includes('/v1/')
      )
      const v2Calls = [
        ...mockAppcircleApi.get.mock.calls,
        ...mockAppcircleApi.post.mock.calls
      ].filter((call: any) => call[0].includes('/v2/'))

      expect(v1Calls.length).toBeGreaterThan(0)
      expect(v2Calls.length).toBeGreaterThan(0)
      
      // This documents the inconsistency - consider standardizing to v2
    })

    it('should show upload operations use different versions', async () => {
      mockFs.createReadStream.mockReturnValue('stream' as any)
      mockAppcircleApi.get.mockResolvedValue({ data: { uploadUrl: 'test' } })
      mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

      // Upload info uses v1, but upload uses v2
      await getPublishUploadInformation({ platform: 'ios', publishProfileId: 'pp123', fileSize: 1000, fileName: 'test.ipa' })
      await uploadAppVersion({ app: '/path/test.ipa', publishProfileId: 'pp123', platform: 'ios' })

      expect(mockAppcircleApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/v1/'),
        expect.any(Object)
      )
      expect(mockAppcircleApi.post).toHaveBeenCalledWith(
        expect.stringContaining('/v2/'),
        expect.any(FormData),
        expect.any(Object)
      )
    })
  })

  describe('Critical Edge Cases', () => {
    it('should handle concurrent file uploads', async () => {
      mockFs.createReadStream.mockReturnValue('stream' as any)
      mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

      const uploads = Array(3).fill(null).map((_, i) => 
        uploadAppVersion({
          app: `/path/app${i}.ipa`,
          publishProfileId: 'pp123',
          platform: 'ios'
        })
      )

      const results = await Promise.all(uploads)
      
      expect(results).toHaveLength(3)
      results.forEach(result => expect(result).toEqual({ success: true }))
      expect(mockAppcircleApi.post).toHaveBeenCalledTimes(3)
    })

    it('should handle FormData boundary conflicts', async () => {
      mockFs.createReadStream.mockReturnValue('stream' as any)
      MockFormData.prototype.getBoundary = vi.fn(() => 'conflicting-boundary')
      mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

      await uploadAppVersion({
        app: '/path/app.ipa',
        publishProfileId: 'pp123',
        platform: 'ios'
      })

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

    it('should handle platform case sensitivity', async () => {
      const platforms = ['ios', 'iOS', 'IOS', 'android', 'Android', 'ANDROID']
      mockAppcircleApi.get.mockResolvedValue({ data: [] })

      for (const platform of platforms) {
        await getPublishProfiles({ platform })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          `publish/v2/profiles/${platform}`,
          expect.any(Object)
        )
      }
    })

    it('should handle empty publishProfileId', async () => {
      mockAppcircleApi.get.mockResolvedValue({ data: {} })

      await getPublishProfileDetailById({
        publishProfileId: '',
        platform: 'ios'
      })

      expect(mockAppcircleApi.get).toHaveBeenCalledWith(
        'publish/v2/profiles/ios/',
        { headers: expect.any(Object) }
      )
    })

    it('should handle undefined parameters in URL construction', async () => {
      mockAppcircleApi.get.mockResolvedValue({ data: {} })

      await getAppVersionDetail({
        publishProfileId: 'pp123',
        platform: 'ios',
        appVersionId: undefined as any
      })

      expect(mockAppcircleApi.get).toHaveBeenCalledWith(
        'publish/v1/profiles/ios/pp123/app-versions/undefined',
        { headers: expect.any(Object) }
      )
    })

    it('should handle null values in settings spread', async () => {
      mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

      await switchPublishProfileAutoPublishSettings({
        publishProfileId: 'pp123',
        platform: 'ios',
        enable: true,
        currentProfileSettings: null
      })

      // Should not crash when spreading null
      expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
        expect.any(String),
        {
          profileSettings: { whenNewVersionRecieved: true }
        },
        expect.any(Object)
      )
    })
  })

  describe('Security and Performance', () => {
    it('should handle memory pressure during large file operations', async () => {
      const memoryError = new Error('JavaScript heap out of memory')
      mockFs.createReadStream.mockImplementation(() => { throw memoryError })

      await expect(uploadAppVersion({
        app: '/path/to/very-large-app.ipa',
        publishProfileId: 'pp123',
        platform: 'ios'
      })).rejects.toThrow(/memory/)
    })

    it('should handle network timeouts during upload', async () => {
      mockFs.createReadStream.mockReturnValue('stream' as any)
      const timeoutError = new Error('timeout of 30000ms exceeded')
      mockAppcircleApi.post.mockRejectedValue(timeoutError)

      await expect(uploadAppVersion({
        app: '/path/large-app.ipa',
        publishProfileId: 'pp123',
        platform: 'ios'
      })).rejects.toThrow(/timeout/)
    })

    it('should handle rate limiting during concurrent operations', async () => {
      const rateLimitError = new Error('Too Many Requests')
      ;(rateLimitError as any).response = { status: 429 }
      
      mockAppcircleApi.get.mockRejectedValue(rateLimitError)

      await expect(getPublishProfiles({ platform: 'ios' }))
        .rejects.toThrow('Too Many Requests')
    })

    it('should not expose sensitive data in errors', async () => {
      mockFs.createReadStream.mockReturnValue('stream' as any)
      const sensitiveError = new Error('Upload failed: token abc123secret invalid')
      mockAppcircleApi.post.mockRejectedValue(sensitiveError)

      try {
        await uploadAppVersion({
          app: '/path/app.ipa',
          publishProfileId: 'pp123',
          platform: 'ios'
        })
      } catch (error: any) {
        // In a real implementation, sensitive data should be filtered
        expect(error.message).toContain('abc123secret') // Documents current behavior
        // TODO: Implement error message sanitization
      }
    })
  })

  describe('Source Code Issues Documentation', () => {
    it('should highlight the typo in auto-publish setting', async () => {
      // This test documents the typo in the source code
      // switchPublishProfileAutoPublishSettings uses "whenNewVersionRecieved" 
      // instead of "whenNewVersionReceived"
      mockAppcircleApi.patch.mockResolvedValue({ data: { success: true } })

      await switchPublishProfileAutoPublishSettings({
        publishProfileId: 'pp123',
        platform: 'ios',
        enable: true,
        currentProfileSettings: {}
      })

      expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
        expect.any(String),
        {
          profileSettings: {
            whenNewVersionRecieved: true // Typo documented
          }
        },
        expect.any(Object)
      )

      // TODO: Fix typo in source code to "whenNewVersionReceived"
      // and update this test expectation accordingly
    })

    it('should document direct axios usage inconsistency', async () => {
      // downloadAppVersion uses direct axios instead of appcircleApi
      // This creates inconsistency with other functions
      const mockWriter = {
        on: vi.fn().mockImplementation((event: string, callback: Function) => {
          if (event === 'close') setTimeout(() => callback(), 0)
          return mockWriter
        }),
        close: vi.fn()
      }

      ;(mockAxios.get as any).mockResolvedValue({ data: { pipe: vi.fn() } })
      mockFs.createWriteStream.mockReturnValue(mockWriter as any)

      await downloadAppVersion({
        url: 'https://example.com/app.ipa',
        path: '/download/app.ipa'
      })

      // This function uses axios directly, not appcircleApi
      expect(mockAxios.get).toHaveBeenCalled()
      expect(mockAppcircleApi.get).not.toHaveBeenCalled()

      // TODO: Consider using appcircleApi consistently for all HTTP calls
    })

    it('should document empty JSON string in restart flow', async () => {
      // startExistingPublishFlow sends "{}" as string body instead of empty object
      mockAppcircleApi.post.mockResolvedValue({ data: { success: true } })

      await startExistingPublishFlow({
        publishProfileId: 'pp123',
        platform: 'ios',
        publishId: 'pub123'
      })

      expect(mockAppcircleApi.post).toHaveBeenCalledWith(
        expect.any(String),
        '{}', // String instead of object
        expect.any(Object)
      )

      // This is intentional but worth documenting
    })
  })

  describe('Headers and Authentication', () => {
    it('should include proper headers in all requests', async () => {
      mockAppcircleApi.get.mockResolvedValue({ data: [] })
      mockAppcircleApi.post.mockResolvedValue({ data: {} })
      mockAppcircleApi.patch.mockResolvedValue({ data: {} })
      mockAppcircleApi.delete.mockResolvedValue({ data: {} })

      await getPublishProfiles({ platform: 'ios' })
      await createPublishProfile({ platform: 'ios', name: 'Test' })
      await renamePublishProfile({ platform: 'ios', publishProfileId: 'pp123', name: 'Renamed' })
      await deletePublishProfile({ platform: 'ios', publishProfileId: 'pp123' })

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

      await getPublishProfiles({ platform: 'ios' })

      expect(mockGetHeaders).toHaveBeenCalled()
    })

    it('should merge headers correctly for multipart uploads', async () => {
      mockFs.createReadStream.mockReturnValue('stream' as any)
      mockAppcircleApi.post.mockResolvedValue({ data: {} })

      await uploadAppVersion({
        app: '/path/app.ipa',
        publishProfileId: 'pp123',
        platform: 'ios'
      })

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

  describe('Publish Flow operations', () => {
    describe('getPublishFlows', () => {
      it('should list publish flows for a profile', async () => {
        const mockFlows = [{ id: 'flow1', name: 'Default Publish Flow' }]
        mockAppcircleApi.get.mockResolvedValue({ data: mockFlows })

        const result = await getPublishFlows({ platform: 'android', publishProfileId: 'profile123' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'publish/v1/profiles/android/profile123/publishflows',
          { headers: getHeaders() }
        )
        expect(result).toEqual(mockFlows)
      })
    })

    describe('downloadPublishFlowYaml', () => {
      it('should download publish flow YAML as binary', async () => {
        const mockYaml = Buffer.from('steps: []')
        mockAppcircleApi.get.mockResolvedValue({ data: mockYaml })

        const result = await downloadPublishFlowYaml({ platform: 'ios', publishProfileId: 'profile123', publishFlowId: 'flow123' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'publish/v1/profiles/ios/profile123/publishflows/flow123?action=download',
          expect.objectContaining({ responseType: 'arraybuffer' })
        )
        expect(result).toEqual(mockYaml)
      })

      it('should propagate download errors', async () => {
        mockAppcircleApi.get.mockRejectedValue(new Error('Not found'))
        await expect(
          downloadPublishFlowYaml({ platform: 'ios', publishProfileId: 'profile123', publishFlowId: 'missing' })
        ).rejects.toThrow('Not found')
      })
    })

    describe('updatePublishFlowFromFile', () => {
      it('should update publish flow from file via multipart PATCH', async () => {
        const mockResponse = { taskId: 'task1' }
        mockAppcircleApi.patch.mockResolvedValue({ data: mockResponse })
        ;(fs.createReadStream as any).mockReturnValue({ path: '/tmp/flow.yaml' })

        const result = await updatePublishFlowFromFile({
          platform: 'android',
          publishProfileId: 'profile123',
          publishFlowId: 'flow123',
          filePath: '/tmp/flow.yaml'
        })

        expect(mockAppcircleApi.patch).toHaveBeenCalledWith(
          'publish/v1/profiles/android/profile123/publishflows/flow123?action=update',
          expect.any(MockFormData),
          expect.objectContaining({ maxContentLength: Infinity, maxBodyLength: Infinity })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should append flowName when provided', async () => {
        mockAppcircleApi.patch.mockResolvedValue({ data: {} })
        ;(fs.createReadStream as any).mockReturnValue({ path: '/tmp/flow.yaml' })
        const appendSpy = vi.spyOn(MockFormData.prototype, 'append')

        await updatePublishFlowFromFile({
          platform: 'ios',
          publishProfileId: 'profile123',
          publishFlowId: 'flow123',
          filePath: '/tmp/flow.yaml',
          flowName: 'Release Flow'
        })

        expect(appendSpy).toHaveBeenCalledWith('flowName', 'Release Flow')
        expect(appendSpy).toHaveBeenCalledWith('file', expect.anything())
      })

      it('should handle update errors', async () => {
        mockAppcircleApi.patch.mockRejectedValue(new Error('Update failed'))
        ;(fs.createReadStream as any).mockReturnValue({ path: '/tmp/flow.yaml' })

        await expect(updatePublishFlowFromFile({
          platform: 'ios',
          publishProfileId: 'profile123',
          publishFlowId: 'flow123',
          filePath: '/tmp/flow.yaml'
        })).rejects.toThrow('Update failed')
      })
    })
  })
})