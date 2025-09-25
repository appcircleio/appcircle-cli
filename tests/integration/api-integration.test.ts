/**
 * @fileoverview API integration tests
 * Tests API interactions with authentication scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup/test-setup';
import { MemoryAuth, setAuth } from '../core/auth-abstraction';

describe('API Integration Tests', () => {
  let auth: MemoryAuth;

  beforeEach(() => {
    auth = new MemoryAuth();
    setAuth(auth);
  });

  describe('Authenticated API Requests', () => {
    beforeEach(async () => {
      // Authenticate for API tests
      await auth.login({ personalAccessKey: 'valid_token' });
    });

    it('should successfully fetch build profiles', async () => {
      // This would be an actual API call in a real scenario
      const mockApiCall = async () => {
        const response = await fetch('https://api.appcircle.io/build/profiles', {
          headers: {
            'Authorization': `Bearer ${auth.getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
      };

      const profiles = await mockApiCall();
      
      expect(profiles).toEqual([
        { id: 'profile_1', name: 'iOS Production', platform: 'iOS' },
        { id: 'profile_2', name: 'Android Production', platform: 'Android' }
      ]);
    });

    it('should successfully fetch organizations', async () => {
      const mockApiCall = async () => {
        const response = await fetch('https://api.appcircle.io/organizations', {
          headers: {
            'Authorization': `Bearer ${auth.getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.json();
      };

      const organizations = await mockApiCall();
      
      expect(organizations).toEqual([
        { id: 'org_1', name: 'Test Organization', role: 'admin' },
        { id: 'org_2', name: 'Demo Org', role: 'member' }
      ]);
    });

    it('should successfully fetch user info', async () => {
      const mockApiCall = async () => {
        const response = await fetch('https://api.appcircle.io/user', {
          headers: {
            'Authorization': `Bearer ${auth.getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        });
        
        return response.json();
      };

      const user = await mockApiCall();
      
      expect(user).toEqual({
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User'
      });
    });
  });

  describe('Unauthenticated API Requests', () => {
    it('should reject requests without authentication', async () => {
      // Don't authenticate
      const mockApiCall = async () => {
        const response = await fetch('https://api.appcircle.io/build/profiles');
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
      };

      await expect(mockApiCall()).rejects.toThrow('HTTP 401');
    });

    it('should reject requests with invalid tokens', async () => {
      const mockApiCall = async () => {
        const response = await fetch('https://api.appcircle.io/build/profiles', {
          headers: {
            'Authorization': 'Bearer invalid_token_123',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
      };

      await expect(mockApiCall()).rejects.toThrow('HTTP 401');
    });
  });

  describe('API Error Scenarios', () => {
    beforeEach(async () => {
      await auth.login({ personalAccessKey: 'valid_token' });
    });

    it('should handle rate limiting errors', async () => {
      const mockApiCall = async () => {
        const response = await fetch('https://api.appcircle.io/rate-limited', {
          headers: {
            'Authorization': `Bearer ${auth.getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`${errorData.error}: ${errorData.message}`);
        }
        
        return response.json();
      };

      await expect(mockApiCall()).rejects.toThrow('rate_limit_exceeded: Too many requests');
    });

    it('should handle server errors', async () => {
      const mockApiCall = async () => {
        const response = await fetch('https://api.appcircle.io/server-error', {
          headers: {
            'Authorization': `Bearer ${auth.getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`${errorData.error}: ${errorData.message}`);
        }
        
        return response.json();
      };

      await expect(mockApiCall()).rejects.toThrow('internal_server_error: Internal server error');
    });

    it('should handle network timeouts', async () => {
      const mockApiCall = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout
        
        try {
          const response = await fetch('https://api.appcircle.io/timeout', {
            headers: {
              'Authorization': `Bearer ${auth.getAccessToken()}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          return response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      };

      await expect(mockApiCall()).rejects.toThrow();
    });
  });

  describe('Cross-platform Compatibility', () => {
    beforeEach(async () => {
      await auth.login({ personalAccessKey: 'valid_token' });
    });

    it('should handle different HTTP status codes correctly', async () => {
      // Test different status codes that might be returned
      const statusCodes = [200, 201, 204, 400, 401, 403, 404, 500];
      
      for (const statusCode of statusCodes) {
        server.use(
          http.get(`https://api.appcircle.io/status/${statusCode}`, () => {
            return HttpResponse.json(
              { message: `Status ${statusCode}` },
              { status: statusCode }
            );
          })
        );

        const mockApiCall = async () => {
          const response = await fetch(`https://api.appcircle.io/status/${statusCode}`, {
            headers: {
              'Authorization': `Bearer ${auth.getAccessToken()}`,
              'Content-Type': 'application/json'
            }
          });
          
          return { status: response.status, ok: response.ok };
        };

        const result = await mockApiCall();
        expect(result.status).toBe(statusCode);
        expect(result.ok).toBe(statusCode >= 200 && statusCode < 300);
      }
    });

    it('should handle different content types', async () => {
      server.use(
        http.get('https://api.appcircle.io/content-test', () => {
          return new Response('plain text response', {
            headers: { 'Content-Type': 'text/plain' }
          });
        })
      );

      const response = await fetch('https://api.appcircle.io/content-test', {
        headers: {
          'Authorization': `Bearer ${auth.getAccessToken()}`
        }
      });

      expect(response.headers.get('Content-Type')).toBe('text/plain');
      const text = await response.text();
      expect(text).toBe('plain text response');
    });
  });
});