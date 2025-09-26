import { describe, it, expect } from 'vitest'

import { 
  FileUploadRequestConfiguration, 
  FileUploadInformation 
} from '../../../src/types/file-upload'

describe('FileUpload Types', () => {
  describe('FileUploadRequestConfiguration', () => {
    it('should define correct structure for POST configuration', () => {
      const postConfig: FileUploadRequestConfiguration = {
        httpMethod: 'POST',
        signParameters: {
          'Content-Type': 'application/octet-stream',
          'Authorization': 'Bearer token123'
        }
      }

      expect(postConfig.httpMethod).toBe('POST')
      expect(postConfig.signParameters).toEqual({
        'Content-Type': 'application/octet-stream',
        'Authorization': 'Bearer token123'
      })
    })

    it('should define correct structure for PUT configuration', () => {
      const putConfig: FileUploadRequestConfiguration = {
        httpMethod: 'PUT',
        signParameters: {
          'x-amz-server-side-encryption': 'AES256'
        }
      }

      expect(putConfig.httpMethod).toBe('PUT')
      expect(putConfig.signParameters).toEqual({
        'x-amz-server-side-encryption': 'AES256'
      })
    })

    it('should allow null signParameters', () => {
      const config: FileUploadRequestConfiguration = {
        httpMethod: 'POST',
        signParameters: null
      }

      expect(config.httpMethod).toBe('POST')
      expect(config.signParameters).toBeNull()
    })

    it('should allow undefined signParameters', () => {
      const config: FileUploadRequestConfiguration = {
        httpMethod: 'PUT'
        // signParameters is optional
      }

      expect(config.httpMethod).toBe('PUT')
      expect(config.signParameters).toBeUndefined()
    })

    it('should only accept valid HTTP methods', () => {
      // TypeScript compile-time test - these should be valid
      const postConfig: FileUploadRequestConfiguration = { httpMethod: 'POST' }
      const putConfig: FileUploadRequestConfiguration = { httpMethod: 'PUT' }

      expect(postConfig.httpMethod).toBe('POST')
      expect(putConfig.httpMethod).toBe('PUT')
    })
  })

  describe('FileUploadInformation', () => {
    it('should define complete upload information structure', () => {
      const uploadInfo: FileUploadInformation = {
        fileId: 'file-123-uuid',
        uploadUrl: 'https://upload.example.com/file/123',
        configuration: {
          httpMethod: 'PUT',
          signParameters: {
            'Content-Type': 'application/zip',
            'x-amz-acl': 'private'
          }
        }
      }

      expect(uploadInfo.fileId).toBe('file-123-uuid')
      expect(uploadInfo.uploadUrl).toBe('https://upload.example.com/file/123')
      expect(uploadInfo.configuration.httpMethod).toBe('PUT')
      expect(uploadInfo.configuration.signParameters).toEqual({
        'Content-Type': 'application/zip',
        'x-amz-acl': 'private'
      })
    })

    it('should work with POST method configuration', () => {
      const uploadInfo: FileUploadInformation = {
        fileId: 'mobile-app-v1.0.0',
        uploadUrl: 'https://api.appcircle.io/upload/mobile-app',
        configuration: {
          httpMethod: 'POST',
          signParameters: {
            'Authorization': 'Bearer access-token',
            'Content-Type': 'multipart/form-data'
          }
        }
      }

      expect(uploadInfo.fileId).toBe('mobile-app-v1.0.0')
      expect(uploadInfo.uploadUrl).toBe('https://api.appcircle.io/upload/mobile-app')
      expect(uploadInfo.configuration.httpMethod).toBe('POST')
    })

    it('should work with minimal configuration', () => {
      const uploadInfo: FileUploadInformation = {
        fileId: 'simple-file-id',
        uploadUrl: 'https://simple.upload.url',
        configuration: {
          httpMethod: 'PUT'
        }
      }

      expect(uploadInfo.fileId).toBe('simple-file-id')
      expect(uploadInfo.uploadUrl).toBe('https://simple.upload.url')
      expect(uploadInfo.configuration.httpMethod).toBe('PUT')
      expect(uploadInfo.configuration.signParameters).toBeUndefined()
    })

    it('should handle empty signParameters object', () => {
      const uploadInfo: FileUploadInformation = {
        fileId: 'test-file',
        uploadUrl: 'https://test.com/upload',
        configuration: {
          httpMethod: 'POST',
          signParameters: {}
        }
      }

      expect(uploadInfo.configuration.signParameters).toEqual({})
    })
  })

  describe('Type compatibility and usage patterns', () => {
    it('should work in typical file upload scenario', () => {
      // Simulate a typical file upload preparation
      const prepareFileUpload = (
        fileId: string, 
        uploadUrl: string, 
        method: 'PUT' | 'POST'
      ): FileUploadInformation => {
        return {
          fileId,
          uploadUrl,
          configuration: {
            httpMethod: method,
            signParameters: method === 'PUT' ? {
              'Content-Type': 'application/octet-stream'
            } : {
              'Authorization': 'Bearer token'
            }
          }
        }
      }

      const putUpload = prepareFileUpload('file1', 'https://s3.example.com', 'PUT')
      const postUpload = prepareFileUpload('file2', 'https://api.example.com', 'POST')

      expect(putUpload.configuration.httpMethod).toBe('PUT')
      expect(postUpload.configuration.httpMethod).toBe('POST')
      expect(putUpload.configuration.signParameters).toHaveProperty('Content-Type')
      expect(postUpload.configuration.signParameters).toHaveProperty('Authorization')
    })
  })
})