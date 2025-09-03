import { describe, it, expect, vi } from 'vitest';
import type { AxiosRequestConfig } from 'axios';
import FormData from 'form-data';
import CurlHelper from '../../../src/utils/curlhelper';

describe('CurlHelper', () => {
  describe('constructor', () => {
    it('should create instance with config', () => {
      const config: AxiosRequestConfig = { url: 'https://api.example.com' };
      const helper = new CurlHelper(config);
      expect(helper).toBeInstanceOf(CurlHelper);
    });
  });

  describe('getMethod', () => {
    it('should return uppercase method with -X prefix', () => {
      const config: AxiosRequestConfig = { method: 'get' };
      const helper = new CurlHelper(config);
      expect(helper.getMethod()).toBe('-X GET');
    });

    it('should return UNKNOWN when method is undefined', () => {
      const config: AxiosRequestConfig = {};
      const helper = new CurlHelper(config);
      expect(helper.getMethod()).toBe('-X UNKNOWN');
    });

    it('should handle post method', () => {
      const config: AxiosRequestConfig = { method: 'post' };
      const helper = new CurlHelper(config);
      expect(helper.getMethod()).toBe('-X POST');
    });
  });

  describe('getUrl', () => {
    it('should return url when no baseURL', () => {
      const config: AxiosRequestConfig = { url: 'https://api.example.com/users' };
      const helper = new CurlHelper(config);
      expect(helper.getUrl()).toBe('https://api.example.com/users');
    });

    it('should combine baseURL and url', () => {
      const config: AxiosRequestConfig = { 
        baseURL: 'https://api.example.com',
        url: 'users'
      };
      const helper = new CurlHelper(config);
      expect(helper.getUrl()).toBe('https://api.example.com/users');
    });

    it('should handle multiple slashes in URL', () => {
      const config: AxiosRequestConfig = { 
        baseURL: 'https://api.example.com/',
        url: '/users'
      };
      const helper = new CurlHelper(config);
      expect(helper.getUrl()).toBe('https://api.example.com/users');
    });

    it('should fix broken http protocol', () => {
      const config: AxiosRequestConfig = { 
        baseURL: 'http:/api.example.com',
        url: 'users'
      };
      const helper = new CurlHelper(config);
      expect(helper.getUrl()).toBe('http://api.example.com/users');
    });

    it('should fix broken https protocol', () => {
      const config: AxiosRequestConfig = { 
        baseURL: 'https:/api.example.com',
        url: 'users'
      };
      const helper = new CurlHelper(config);
      expect(helper.getUrl()).toBe('https://api.example.com/users');
    });
  });

  describe('getQueryString', () => {
    it('should return empty string when no params', () => {
      const config: AxiosRequestConfig = {};
      const helper = new CurlHelper(config);
      expect(helper.getQueryString()).toBe('');
    });

    it('should return empty string when params is empty', () => {
      const config: AxiosRequestConfig = { params: '' };
      const helper = new CurlHelper(config);
      expect(helper.getQueryString()).toBe('');
    });

    it('should return params as-is when starts with ?', () => {
      const config: AxiosRequestConfig = { params: '?name=test&age=25' };
      const helper = new CurlHelper(config);
      expect(helper.getQueryString()).toBe('?name=test&age=25');
    });

    it('should add ? prefix when params does not start with ?', () => {
      const config: AxiosRequestConfig = { params: 'name=test&age=25' };
      const helper = new CurlHelper(config);
      expect(helper.getQueryString()).toBe('?name=test&age=25');
    });

    it('should use paramsSerializer when provided', () => {
      const serializer = vi.fn().mockReturnValue('custom=serialized');
      const config: AxiosRequestConfig = { 
        params: { name: 'test' },
        paramsSerializer: serializer
      };
      const helper = new CurlHelper(config);
      expect(helper.getQueryString()).toBe('?custom=serialized');
      expect(serializer).toHaveBeenCalledWith({ name: 'test' });
    });
  });

  describe('getBuiltURL', () => {
    it('should combine URL and query string', () => {
      const config: AxiosRequestConfig = { 
        url: 'https://api.example.com/users',
        params: 'limit=10'
      };
      const helper = new CurlHelper(config);
      expect(helper.getBuiltURL()).toBe('https://api.example.com/users?limit=10');
    });

    it('should return URL without query when no params', () => {
      const config: AxiosRequestConfig = { url: 'https://api.example.com/users' };
      const helper = new CurlHelper(config);
      expect(helper.getBuiltURL()).toBe('https://api.example.com/users');
    });

    it('should return UNKNOWN_URL when url is undefined', () => {
      const config: AxiosRequestConfig = {};
      const helper = new CurlHelper(config);
      expect(helper.getBuiltURL()).toBe('UNKNOWN_URL');
    });
  });

  describe('getHeaders', () => {
    it('should return empty string when no headers', () => {
      const config: AxiosRequestConfig = { headers: {} };
      const helper = new CurlHelper(config);
      expect(helper.getHeaders()).toBe('');
    });

    it('should format simple headers', () => {
      const config: AxiosRequestConfig = { 
        headers: { 'Authorization': 'Bearer token', 'Content-Type': 'application/json' }
      };
      const helper = new CurlHelper(config);
      const result = helper.getHeaders();
      expect(result).toContain('-H "Authorization:Bearer token"');
      expect(result).toContain('-H "Content-Type:application/json"');
    });

    it('should skip common headers', () => {
      const config: AxiosRequestConfig = { 
        headers: { 
          'Authorization': 'Bearer token'
        }
      };
      const helper = new CurlHelper(config);
      const result = helper.getHeaders();
      expect(result).toContain('-H "Authorization:Bearer token"');
    });

    it('should use method-specific headers when available', () => {
      const config: AxiosRequestConfig = { 
        method: 'post',
        headers: { 
          'common': { 'Accept': 'application/json' } as any,
          'post': { 'Content-Type': 'application/json' } as any,
          'Authorization': 'Bearer token'
        }
      };
      const helper = new CurlHelper(config);
      const result = helper.getHeaders();
      expect(result).toContain('-H "Content-Type:application/json"');
      expect(result).toContain('-H "Authorization:Bearer token"');
    });

    it('should skip content-type header for FormData', () => {
      const formData = new FormData();
      const config: AxiosRequestConfig = { 
        data: formData,
        headers: { 
          'content-type': 'multipart/form-data',
          'Authorization': 'Bearer token'
        }
      };
      const helper = new CurlHelper(config);
      const result = helper.getHeaders();
      expect(result).not.toContain('content-type');
      expect(result).toContain('-H "Authorization:Bearer token"');
    });
  });

  describe('getBody', () => {
    it('should return empty string for GET requests', () => {
      const config: AxiosRequestConfig = { 
        method: 'get',
        data: { name: 'test' }
      };
      const helper = new CurlHelper(config);
      expect(helper.getBody()).toBe('');
    });

    it('should return empty string when data is undefined', () => {
      const config: AxiosRequestConfig = { method: 'post' };
      const helper = new CurlHelper(config);
      expect(helper.getBody()).toBe('');
    });

    it('should return empty string when data is empty string', () => {
      const config: AxiosRequestConfig = { 
        method: 'post',
        data: ''
      };
      const helper = new CurlHelper(config);
      expect(helper.getBody()).toBe('');
    });

    it('should return empty string when data is null', () => {
      const config: AxiosRequestConfig = { 
        method: 'post',
        data: null
      };
      const helper = new CurlHelper(config);
      expect(helper.getBody()).toBe('');
    });

    it('should format object data as JSON', () => {
      const config: AxiosRequestConfig = { 
        method: 'post',
        data: { name: 'test', age: 25 }
      };
      const helper = new CurlHelper(config);
      expect(helper.getBody()).toBe('--data \'{"name":"test","age":25}\'');
    });

    it('should format array data as JSON', () => {
      const config: AxiosRequestConfig = { 
        method: 'post',
        data: ['item1', 'item2']
      };
      const helper = new CurlHelper(config);
      expect(helper.getBody()).toBe('--data \'["item1","item2"]\'');
    });

    it('should return string data as-is', () => {
      const config: AxiosRequestConfig = { 
        method: 'post',
        data: 'raw string data'
      };
      const helper = new CurlHelper(config);
      expect(helper.getBody()).toBe('--data \'raw string data\'');
    });

    it('should handle FormData', () => {
      const formData = new FormData();
      formData.append('field1', 'value1');
      
      const config: AxiosRequestConfig = { 
        method: 'post',
        data: formData
      };
      
      const helper = new CurlHelper(config);
      const result = helper.getBody();
      
      expect(result).toContain('-F');
    });
  });

  describe('parseFormData', () => {
    it('should parse form data with file field', () => {
      const helper = new CurlHelper({});
      const mockForm = {
        _streams: [
          'Content-Disposition: form-data; name="File"; filename="test.txt"',
          'file content'
        ]
      };
      
      const result = helper.parseFormData(mockForm);
      expect(result.File).toBe('test.txt');
      expect(result.postData).toContain('-F "File=@test.txt"');
    });

    it('should parse form data with regular field', () => {
      const helper = new CurlHelper({});
      const mockForm = {
        _streams: [
          'Content-Disposition: form-data; name="username"',
          'testuser'
        ]
      };
      
      const result = helper.parseFormData(mockForm);
      expect(result.username).toBe('testuser');
      expect(result.postData).toContain('-F "username=testuser"');
    });

    it('should skip carriage return lines', () => {
      const helper = new CurlHelper({});
      const mockForm = {
        _streams: [
          'Content-Disposition: form-data; name="field"',
          '\\r\\n',
          'value'
        ]
      };
      
      const result = helper.parseFormData(mockForm);
      expect(result.field).toBe('value');
    });
  });

  describe('generateCommand', () => {
    it('should generate complete curl command', () => {
      const config: AxiosRequestConfig = { 
        method: 'post',
        url: 'https://api.example.com/users',
        headers: { 'Authorization': 'Bearer token' },
        data: { name: 'test' }
      };
      const helper = new CurlHelper(config);
      const result = helper.generateCommand();
      
      expect(result).toContain('curl -X POST');
      expect(result).toContain('"https://api.example.com/users"');
      expect(result).toContain('-H "Authorization:Bearer token"');
      expect(result).toContain('--data');
    });

    it('should normalize multiple spaces', () => {
      const config: AxiosRequestConfig = { 
        method: 'get',
        url: 'https://api.example.com/users',
        headers: {}
      };
      const helper = new CurlHelper(config);
      const result = helper.generateCommand();
      
      expect(result).not.toMatch(/\s{2,}/);
    });

    it('should trim whitespace', () => {
      const config: AxiosRequestConfig = { 
        method: 'get',
        url: 'https://api.example.com/users',
        headers: {}
      };
      const helper = new CurlHelper(config);
      const result = helper.generateCommand();
      
      expect(result).toBe(result.trim());
    });
  });
});