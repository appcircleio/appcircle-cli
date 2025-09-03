import { describe, it, expect } from 'vitest';
import type { 
  FileUploadRequestConfiguration, 
  FileUploadInformation 
} from '../../../src/types/file-upload';

describe('file-upload types', () => {
  describe('FileUploadRequestConfiguration', () => {
    it('should accept PUT method', () => {
      const config: FileUploadRequestConfiguration = {
        httpMethod: 'PUT'
      };
      
      expect(config.httpMethod).toBe('PUT');
      expect(config.signParameters).toBeUndefined();
    });

    it('should accept POST method', () => {
      const config: FileUploadRequestConfiguration = {
        httpMethod: 'POST'
      };
      
      expect(config.httpMethod).toBe('POST');
      expect(config.signParameters).toBeUndefined();
    });

    it('should accept signParameters as object', () => {
      const config: FileUploadRequestConfiguration = {
        httpMethod: 'PUT',
        signParameters: { key: 'value', token: 'abc123' }
      };
      
      expect(config.httpMethod).toBe('PUT');
      expect(config.signParameters).toEqual({ key: 'value', token: 'abc123' });
    });

    it('should accept signParameters as null', () => {
      const config: FileUploadRequestConfiguration = {
        httpMethod: 'POST',
        signParameters: null
      };
      
      expect(config.httpMethod).toBe('POST');
      expect(config.signParameters).toBeNull();
    });

    it('should accept signParameters as undefined', () => {
      const config: FileUploadRequestConfiguration = {
        httpMethod: 'PUT',
        signParameters: undefined
      };
      
      expect(config.httpMethod).toBe('PUT');
      expect(config.signParameters).toBeUndefined();
    });

    it('should accept empty signParameters object', () => {
      const config: FileUploadRequestConfiguration = {
        httpMethod: 'POST',
        signParameters: {}
      };
      
      expect(config.httpMethod).toBe('POST');
      expect(config.signParameters).toEqual({});
    });
  });

  describe('FileUploadInformation', () => {
    it('should contain all required properties', () => {
      const uploadInfo: FileUploadInformation = {
        fileId: 'file-123',
        uploadUrl: 'https://upload.example.com/file',
        configuration: {
          httpMethod: 'PUT'
        }
      };
      
      expect(uploadInfo.fileId).toBe('file-123');
      expect(uploadInfo.uploadUrl).toBe('https://upload.example.com/file');
      expect(uploadInfo.configuration.httpMethod).toBe('PUT');
    });

    it('should work with POST method configuration', () => {
      const uploadInfo: FileUploadInformation = {
        fileId: 'file-456',
        uploadUrl: 'https://api.example.com/upload',
        configuration: {
          httpMethod: 'POST',
          signParameters: { signature: 'xyz789' }
        }
      };
      
      expect(uploadInfo.fileId).toBe('file-456');
      expect(uploadInfo.uploadUrl).toBe('https://api.example.com/upload');
      expect(uploadInfo.configuration.httpMethod).toBe('POST');
      expect(uploadInfo.configuration.signParameters).toEqual({ signature: 'xyz789' });
    });

    it('should work with complex configuration', () => {
      const uploadInfo: FileUploadInformation = {
        fileId: 'complex-file-789',
        uploadUrl: 'https://s3.amazonaws.com/bucket/key',
        configuration: {
          httpMethod: 'PUT',
          signParameters: {
            'x-amz-signature': 'signature-value',
            'x-amz-date': '20231201T120000Z',
            'x-amz-algorithm': 'AWS4-HMAC-SHA256'
          }
        }
      };
      
      expect(uploadInfo.fileId).toBe('complex-file-789');
      expect(uploadInfo.uploadUrl).toBe('https://s3.amazonaws.com/bucket/key');
      expect(uploadInfo.configuration.httpMethod).toBe('PUT');
      expect(uploadInfo.configuration.signParameters).toEqual({
        'x-amz-signature': 'signature-value',
        'x-amz-date': '20231201T120000Z',
        'x-amz-algorithm': 'AWS4-HMAC-SHA256'
      });
    });

    it('should work with null signParameters', () => {
      const uploadInfo: FileUploadInformation = {
        fileId: 'simple-file',
        uploadUrl: 'https://upload.service.com/endpoint',
        configuration: {
          httpMethod: 'POST',
          signParameters: null
        }
      };
      
      expect(uploadInfo.fileId).toBe('simple-file');
      expect(uploadInfo.uploadUrl).toBe('https://upload.service.com/endpoint');
      expect(uploadInfo.configuration.httpMethod).toBe('POST');
      expect(uploadInfo.configuration.signParameters).toBeNull();
    });

    it('should work without signParameters', () => {
      const uploadInfo: FileUploadInformation = {
        fileId: 'no-params-file',
        uploadUrl: 'https://direct.upload.com/path',
        configuration: {
          httpMethod: 'PUT'
        }
      };
      
      expect(uploadInfo.fileId).toBe('no-params-file');
      expect(uploadInfo.uploadUrl).toBe('https://direct.upload.com/path');
      expect(uploadInfo.configuration.httpMethod).toBe('PUT');
      expect(uploadInfo.configuration.signParameters).toBeUndefined();
    });
  });

  describe('Type safety tests', () => {
    it('should enforce httpMethod to be PUT or POST only', () => {
      // These should compile fine
      const putConfig: FileUploadRequestConfiguration = { httpMethod: 'PUT' };
      const postConfig: FileUploadRequestConfiguration = { httpMethod: 'POST' };
      
      expect(putConfig.httpMethod).toBe('PUT');
      expect(postConfig.httpMethod).toBe('POST');
      
      // TypeScript should prevent other values like 'GET', 'DELETE', etc.
      // but we can't test compilation errors in runtime tests
    });

    it('should enforce required properties in FileUploadInformation', () => {
      // This should compile fine with all required properties
      const completeInfo: FileUploadInformation = {
        fileId: 'test-file',
        uploadUrl: 'https://test.com',
        configuration: { httpMethod: 'PUT' }
      };
      
      expect(completeInfo.fileId).toBeDefined();
      expect(completeInfo.uploadUrl).toBeDefined();
      expect(completeInfo.configuration).toBeDefined();
    });

    it('should allow string keys in signParameters', () => {
      const config: FileUploadRequestConfiguration = {
        httpMethod: 'POST',
        signParameters: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
          'X-Custom-Header': 'custom-value'
        }
      };
      
      expect(config.signParameters).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token',
        'X-Custom-Header': 'custom-value'
      });
    });
  });
});