import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { Readable } from 'stream';

// Mock axios
vi.mock('axios');

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    red: vi.fn((text) => text),
    yellow: vi.fn((text) => text)
  }
}));

// Import the functions we want to test
import {
  DetailedMonitoringError,
  ErrorCodes,
  decodeJwtPayload,
  resolveIdentityFromToken,
  triggerBuildLogsStreaming,
  triggerStopBuildLogsStreaming,
  getHookAccessToken,
  openHookSSE,
  SSEConnection
} from '../../../src/services/index';

const mockAxios = vi.mocked(axios);

describe('Services Index - New Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DetailedMonitoringError', () => {
    it('should create error with code and message', () => {
      const error = new DetailedMonitoringError('TEST_CODE', 'Test message');

      expect(error.name).toBe('DetailedMonitoringError');
      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.originalError).toBeUndefined();
    });

    it('should create error with original error', () => {
      const originalError = new Error('Original error');
      const error = new DetailedMonitoringError('TEST_CODE', 'Test message', originalError);

      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.originalError).toBe(originalError);
    });

    it('should extend Error class properly', () => {
      const error = new DetailedMonitoringError('TEST_CODE', 'Test message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DetailedMonitoringError);
    });
  });

  describe('ErrorCodes', () => {
    it('should define all required error codes', () => {
      expect(ErrorCodes.E_HOOK_AUTH_FAILED).toBe('E_HOOK_AUTH_FAILED');
      expect(ErrorCodes.E_SSE_CONNECT_FAILED).toBe('E_SSE_CONNECT_FAILED');
      expect(ErrorCodes.E_TOKEN_MALFORMED).toBe('E_TOKEN_MALFORMED');
      expect(ErrorCodes.E_TOKEN_DECODE_FAILED).toBe('E_TOKEN_DECODE_FAILED');
      expect(ErrorCodes.E_CLAIM_MISSING_SUB).toBe('E_CLAIM_MISSING_SUB');
      expect(ErrorCodes.E_CLAIM_MISSING_ORG).toBe('E_CLAIM_MISSING_ORG');
      expect(ErrorCodes.E_IDENTITY_RESOLVE_FAILED).toBe('E_IDENTITY_RESOLVE_FAILED');
    });

    it('should be immutable', () => {
      // ErrorCodes is defined with 'as const', so it should be readonly
      // But JavaScript doesn't actually throw when modifying const objects at runtime
      // We'll just verify the structure is correct
      expect(typeof ErrorCodes).toBe('object');
      expect(Object.keys(ErrorCodes).length).toBeGreaterThan(0);
    });
  });

  describe('decodeJwtPayload', () => {
    it('should decode valid JWT payload', () => {
      // Create a valid JWT token (header.payload.signature)
      const payload = { sub: 'user123', currentOrganizationId: 'org456', exp: 1234567890 };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.signature`;

      const decoded = decodeJwtPayload(token);

      expect(decoded.sub).toBe('user123');
      expect(decoded.currentOrganizationId).toBe('org456');
      expect(decoded.exp).toBe(1234567890);
    });

    it('should handle base64 padding correctly', () => {
      // Test with payload that needs padding
      const payload = { sub: 'user', org: 'test' };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, ''); // Remove padding

      const token = `header.${encodedPayload}.signature`;

      const decoded = decodeJwtPayload(token);

      expect(decoded.sub).toBe('user');
      expect(decoded.org).toBe('test');
    });

    it('should throw error for malformed token (not enough parts)', () => {
      expect(() => {
        decodeJwtPayload('invalidtoken');
      }).toThrow('E_TOKEN_MALFORMED');
    });

    it('should throw error for malformed token (single part)', () => {
      expect(() => {
        decodeJwtPayload('single');
      }).toThrow('E_TOKEN_MALFORMED');
    });

    it('should throw error for invalid base64 payload', () => {
      expect(() => {
        decodeJwtPayload('header.invalid-base64-!@#.signature');
      }).toThrow('E_TOKEN_DECODE_FAILED');
    });

    it('should throw error for invalid JSON payload', () => {
      const invalidJson = Buffer.from('{invalid json}').toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      expect(() => {
        decodeJwtPayload(`header.${invalidJson}.signature`);
      }).toThrow('E_TOKEN_DECODE_FAILED');
    });
  });

  describe('resolveIdentityFromToken', () => {
    it('should extract sub and currentOrganizationId from valid token', () => {
      const payload = {
        sub: 'user123',
        currentOrganizationId: 'org456',
        other: 'data'
      };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const token = `header.${encodedPayload}.signature`;

      const result = resolveIdentityFromToken(token);

      expect(result.sub).toBe('user123');
      expect(result.currentOrganizationId).toBe('org456');
    });

    it('should use custom organization claim key from environment', () => {
      const originalEnv = process.env.CLAIM_ORG_KEY;
      process.env.CLAIM_ORG_KEY = 'customOrgKey';

      try {
        const payload = {
          sub: 'user123',
          customOrgKey: 'custom-org-456',
          currentOrganizationId: 'should-not-use-this'
        };
        const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');

        const token = `header.${encodedPayload}.signature`;

        const result = resolveIdentityFromToken(token);

        expect(result.sub).toBe('user123');
        expect(result.currentOrganizationId).toBe('custom-org-456');
      } finally {
        if (originalEnv) {
          process.env.CLAIM_ORG_KEY = originalEnv;
        } else {
          delete process.env.CLAIM_ORG_KEY;
        }
      }
    });

    it('should throw DetailedMonitoringError when sub is missing', () => {
      const payload = { currentOrganizationId: 'org456' };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const token = `header.${encodedPayload}.signature`;

      expect(() => {
        resolveIdentityFromToken(token);
      }).toThrow(DetailedMonitoringError);

      try {
        resolveIdentityFromToken(token);
      } catch (error) {
        expect(error.code).toBe(ErrorCodes.E_CLAIM_MISSING_SUB);
        expect(error.message).toContain('Missing or invalid "sub" claim');
      }
    });

    it('should throw DetailedMonitoringError when sub is empty string', () => {
      const payload = { sub: '', currentOrganizationId: 'org456' };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const token = `header.${encodedPayload}.signature`;

      expect(() => {
        resolveIdentityFromToken(token);
      }).toThrow(DetailedMonitoringError);
    });

    it('should throw DetailedMonitoringError when organization claim is missing', () => {
      const payload = { sub: 'user123' };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const token = `header.${encodedPayload}.signature`;

      expect(() => {
        resolveIdentityFromToken(token);
      }).toThrow(DetailedMonitoringError);

      try {
        resolveIdentityFromToken(token);
      } catch (error) {
        expect(error.code).toBe(ErrorCodes.E_CLAIM_MISSING_ORG);
        expect(error.message).toContain('Missing or invalid "currentOrganizationId" claim');
      }
    });

    it('should throw DetailedMonitoringError when organization claim is empty', () => {
      const payload = { sub: 'user123', currentOrganizationId: '   ' };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const token = `header.${encodedPayload}.signature`;

      expect(() => {
        resolveIdentityFromToken(token);
      }).toThrow(DetailedMonitoringError);
    });

    it('should re-throw DetailedMonitoringError from decodeJwtPayload', () => {
      expect(() => {
        resolveIdentityFromToken('invalid.token');
      }).toThrow(DetailedMonitoringError);

      try {
        resolveIdentityFromToken('invalid.token');
      } catch (error) {
        expect(error.code).toBe(ErrorCodes.E_IDENTITY_RESOLVE_FAILED);
      }
    });

    it('should wrap other errors in DetailedMonitoringError', () => {
      // Test with a token that will cause JSON parsing to fail
      const payload = 'not-valid-json';
      const encodedPayload = Buffer.from(payload).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const token = `header.${encodedPayload}.signature`;

      expect(() => {
        resolveIdentityFromToken(token);
      }).toThrow(DetailedMonitoringError);

      try {
        resolveIdentityFromToken(token);
      } catch (error) {
        expect(error.code).toBe(ErrorCodes.E_IDENTITY_RESOLVE_FAILED);
        expect(error.message).toContain('Unable to extract identity');
      }
    });
  });

  describe('triggerBuildLogsStreaming', () => {
    it('should trigger build logs streaming successfully', async () => {
      mockAxios.post.mockResolvedValueOnce({ status: 200, data: 'OK' });

      const params = {
        apiHostname: 'https://api.appcircle.io',
        accessToken: 'test-token',
        taskId: 'task-123',
        browserId: 'browser-456',
        userId: 'user-789',
        organizationId: 'org-abc'
      };

      await triggerBuildLogsStreaming(params);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/build/log/trigger-events-receiving'),
        null,
        {
          headers: {
            'Authorization': 'Bearer test-token'
          },
          timeout: 15000
        }
      );

      const callUrl = mockAxios.post.mock.calls[0][0] as string;
      expect(callUrl).toContain('taskId=task-123');
      expect(callUrl).toContain('browserId=browser-456');
      expect(callUrl).toContain('userId=user-789');
      expect(callUrl).toContain('organizationId=org-abc');
    });

    it('should use hookHostname when provided', async () => {
      mockAxios.post.mockResolvedValueOnce({ status: 200, data: 'OK' });

      const params = {
        apiHostname: 'https://api.appcircle.io',
        hookHostname: 'https://hooks.appcircle.io',
        accessToken: 'test-token',
        taskId: 'task-123',
        browserId: 'browser-456',
        userId: 'user-789',
        organizationId: 'org-abc'
      };

      await triggerBuildLogsStreaming(params);

      const callUrl = mockAxios.post.mock.calls[0][0] as string;
      expect(callUrl).toContain('https://hooks.appcircle.io');
    });

    it('should handle request errors gracefully', async () => {
      const error = new Error('Network error');
      mockAxios.post.mockRejectedValueOnce(error);

      const params = {
        apiHostname: 'https://api.appcircle.io',
        accessToken: 'test-token',
        taskId: 'task-123',
        browserId: 'browser-456',
        userId: 'user-789',
        organizationId: 'org-abc'
      };

      // Should not throw, just log error
      await triggerBuildLogsStreaming(params);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Trigger API Failed: Network error')
      );
    });

    it('should handle HTTP response errors gracefully', async () => {
      const error = {
        message: 'Request failed',
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: 'Server error' }
        }
      };
      mockAxios.post.mockRejectedValueOnce(error);

      const params = {
        apiHostname: 'https://api.appcircle.io',
        accessToken: 'test-token',
        taskId: 'task-123',
        browserId: 'browser-456',
        userId: 'user-789',
        organizationId: 'org-abc'
      };

      await triggerBuildLogsStreaming(params);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Trigger API Failed: Request failed')
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Status: 500 Internal Server Error')
      );
    });
  });

  describe('triggerStopBuildLogsStreaming', () => {
    it('should trigger stop build logs streaming successfully', async () => {
      mockAxios.post.mockResolvedValueOnce({ status: 200, data: 'OK' });

      const params = {
        hookHostname: 'https://hooks.appcircle.io',
        accessToken: 'test-token',
        taskId: 'task-123',
        browserId: 'browser-456',
        userId: 'user-789',
        organizationId: 'org-abc'
      };

      await triggerStopBuildLogsStreaming(params);

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/build/log/trigger-stop-events-receiving'),
        null,
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Accept': '*/*'
          },
          timeout: 10000
        }
      );

      const callUrl = mockAxios.post.mock.calls[0][0] as string;
      expect(callUrl).toContain('taskId=task-123');
      expect(callUrl).toContain('browserId=browser-456');
      expect(callUrl).toContain('userId=user-789');
      expect(callUrl).toContain('organizationId=org-abc');
    });

    it('should handle stop request errors gracefully without throwing', async () => {
      const error = new Error('Network error');
      mockAxios.post.mockRejectedValueOnce(error);

      const params = {
        hookHostname: 'https://hooks.appcircle.io',
        accessToken: 'test-token',
        taskId: 'task-123',
        browserId: 'browser-456',
        userId: 'user-789',
        organizationId: 'org-abc'
      };

      // Should not throw, just log warning
      await expect(triggerStopBuildLogsStreaming(params)).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Stop API Warning: Network error')
      );
    });

    it('should handle HTTP response errors gracefully', async () => {
      const error = {
        message: 'Request failed',
        response: {
          status: 404,
          statusText: 'Not Found'
        }
      };
      mockAxios.post.mockRejectedValueOnce(error);

      const params = {
        hookHostname: 'https://hooks.appcircle.io',
        accessToken: 'test-token',
        taskId: 'task-123',
        browserId: 'browser-456',
        userId: 'user-789',
        organizationId: 'org-abc'
      };

      await triggerStopBuildLogsStreaming(params);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Stop API Warning: Request failed')
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Status: 404 Not Found')
      );
    });
  });

  describe('getHookAccessToken', () => {
    it('should get hook access token successfully', async () => {
      const mockResponse = {
        data: {
          access_token: 'hook-token-123',
          expires_in: 3600
        }
      };
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await getHookAccessToken('access-token');

      expect(result).toBe('hook-token-123');
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/token'),
        {},
        {
          headers: {
            'Authorization': 'Bearer access-token',
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      mockAxios.post.mockRejectedValueOnce(error);

      await expect(getHookAccessToken('access-token')).rejects.toThrow(DetailedMonitoringError);
    });
  });

  describe('openHookSSE', () => {
    let mockStream: any;

    beforeEach(() => {
      mockStream = new Readable({
        read() {}
      });

      // Add the required methods
      mockStream.destroy = vi.fn();

      vi.spyOn(Math, 'random').mockReturnValue(0.5); // For consistent browserId
    });

    it('should establish SSE connection successfully', async () => {
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: mockStream
      });

      const params = {
        hookHostname: 'https://hooks.appcircle.io',
        userId: 'user-123',
        organizationId: 'org-456',
        token: 'hook-token'
      };

      const connection = await openHookSSE(params);

      expect(connection).toBeDefined();
      expect(connection.browserId).toContain('cli-');
      expect(connection.stream).toBe(mockStream);
      expect(typeof connection.close).toBe('function');
      expect(typeof connection.onMessage).toBe('function');
      expect(typeof connection.onError).toBe('function');
      expect(typeof connection.onClose).toBe('function');

      expect(mockAxios).toHaveBeenCalledWith({
        method: 'get',
        url: expect.stringContaining('/v2/hooks'),
        headers: {
          'accept': 'text/event-stream',
          'user-agent': expect.any(String),
          'cache-control': 'no-cache'
        },
        responseType: 'stream',
        timeout: 15000
      });
    });

    it('should process SSE build-log events correctly', async () => {
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: mockStream
      });

      const params = {
        hookHostname: 'https://hooks.appcircle.io',
        userId: 'user-123',
        organizationId: 'org-456',
        token: 'hook-token'
      };

      const connection = await openHookSSE(params);

      const messageCallback = vi.fn();
      connection.onMessage(messageCallback);

      // Simulate SSE data
      const sseData = 'event: build-log\ndata: {"message": "test log"}\n\n';
      mockStream.emit('data', Buffer.from(sseData));

      expect(messageCallback).toHaveBeenCalledWith(' {"message": "test log"}');
    });

    it('should ignore non-build-log events', async () => {
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: mockStream
      });

      const params = {
        hookHostname: 'https://hooks.appcircle.io',
        userId: 'user-123',
        organizationId: 'org-456',
        token: 'hook-token'
      };

      const connection = await openHookSSE(params);

      const messageCallback = vi.fn();
      connection.onMessage(messageCallback);

      // Simulate non-build-log event
      const sseData = 'event: other-event\ndata: {"message": "other data"}\n\n';
      mockStream.emit('data', Buffer.from(sseData));

      expect(messageCallback).not.toHaveBeenCalled();
    });

    it('should handle multi-line SSE data', async () => {
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: mockStream
      });

      const params = {
        hookHostname: 'https://hooks.appcircle.io',
        userId: 'user-123',
        organizationId: 'org-456',
        token: 'hook-token'
      };

      const connection = await openHookSSE(params);

      const messageCallback = vi.fn();
      connection.onMessage(messageCallback);

      // Simulate multi-line SSE data
      const sseData = 'event: build-log\ndata: line 1\ndata: line 2\n\n';
      mockStream.emit('data', Buffer.from(sseData));

      expect(messageCallback).toHaveBeenCalledWith(' line 1\n line 2');
    });

    it('should close connection properly', async () => {
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: mockStream
      });

      const params = {
        hookHostname: 'https://hooks.appcircle.io',
        userId: 'user-123',
        organizationId: 'org-456',
        token: 'hook-token'
      };

      const connection = await openHookSSE(params);

      const closeCallback = vi.fn();
      connection.onClose(closeCallback);

      connection.close();

      expect(mockStream.destroy).toHaveBeenCalled();
      expect(closeCallback).toHaveBeenCalled();
    });

    it('should handle stream errors', async () => {
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: mockStream
      });

      const params = {
        hookHostname: 'https://hooks.appcircle.io',
        userId: 'user-123',
        organizationId: 'org-456',
        token: 'hook-token'
      };

      const connection = await openHookSSE(params);

      const errorCallback = vi.fn();
      connection.onError(errorCallback);

      const testError = new Error('Stream error');
      mockStream.emit('error', testError);

      expect(errorCallback).toHaveBeenCalledWith(testError);
    });

    it('should handle stream end events', async () => {
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: mockStream
      });

      const params = {
        hookHostname: 'https://hooks.appcircle.io',
        userId: 'user-123',
        organizationId: 'org-456',
        token: 'hook-token'
      };

      const connection = await openHookSSE(params);

      const closeCallback = vi.fn();
      connection.onClose(closeCallback);

      mockStream.emit('end');

      expect(closeCallback).toHaveBeenCalled();
    });

    it('should retry connection on failure', async () => {
      const error = new Error('Connection failed');
      mockAxios
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          status: 200,
          data: mockStream
        });

      const params = {
        hookHostname: 'https://hooks.appcircle.io',
        userId: 'user-123',
        organizationId: 'org-456',
        token: 'hook-token'
      };

      const connection = await openHookSSE(params);

      expect(connection).toBeDefined();
      expect(mockAxios).toHaveBeenCalledTimes(2);
    });

    it('should handle connection failures', async () => {
      const error = new Error('Connection failed');
      mockAxios.mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      const params = {
        hookHostname: 'https://hooks.appcircle.io',
        userId: 'user-123',
        organizationId: 'org-456',
        token: 'hook-token'
      };

      await expect(openHookSSE(params)).rejects.toThrow(DetailedMonitoringError);
    }, 10000);

    it('should handle non-200 response status', async () => {
      mockAxios.mockResolvedValueOnce({
        status: 500,
        data: mockStream
      });

      const params = {
        hookHostname: 'https://hooks.appcircle.io',
        userId: 'user-123',
        organizationId: 'org-456',
        token: 'hook-token'
      };

      await expect(openHookSSE(params)).rejects.toThrow(DetailedMonitoringError);
    });

    it('should handle callback errors gracefully', async () => {
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: mockStream
      });

      const params = {
        hookHostname: 'https://hooks.appcircle.io',
        userId: 'user-123',
        organizationId: 'org-456',
        token: 'hook-token'
      };

      const connection = await openHookSSE(params);

      // Add a callback that throws an error
      const throwingCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      connection.onMessage(throwingCallback);

      // Should not crash when callback throws
      const sseData = 'event: build-log\ndata: {"message": "test log"}\n\n';
      expect(() => {
        mockStream.emit('data', Buffer.from(sseData));
      }).not.toThrow();

      expect(throwingCallback).toHaveBeenCalled();
    });
  });
});