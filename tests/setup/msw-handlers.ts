/**
 * MSW handlers for API mocking in integration tests
 */
import { http, HttpResponse } from 'msw';

const API_BASE = 'https://api.appcircle.io';
const AUTH_BASE = 'https://auth.appcircle.io';

export const authHandlers = [
  // PAT Login handler  
  http.post(`${AUTH_BASE}/auth/v1/token`, async ({ request }) => {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const pat = params.get('pat');
    
    if (pat === 'valid_pat_token') {
      return HttpResponse.json({
        access_token: 'mock_access_token_123',
        refresh_token: 'mock_refresh_token_123',
        expires_in: 3600,
        token_type: 'Bearer'
      });
    }
    
    if (pat === 'expired_pat_token') {
      return HttpResponse.json({
        error: 'invalid_grant',
        error_description: 'PAT token expired'
      }, { status: 401 });
    }
    
    // Invalid PAT token
    return HttpResponse.json({
      error: 'invalid_grant',
      error_description: 'Invalid PAT token'
    }, { status: 401 });
  }),

  // API Key Login handler  
  http.post(`${AUTH_BASE}/auth/v1/api-key/token`, async ({ request }) => {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const name = params.get('name');
    const secret = params.get('secret');
    
    if (name === 'test@example.com' && secret === 'valid_api_key') {
      return HttpResponse.json({
        access_token: 'mock_api_access_token_123',
        refresh_token: 'mock_refresh_token_123',
        expires_in: 3600,
        token_type: 'Bearer'
      });
    }
    
    // Invalid API key credentials
    return HttpResponse.json({
      error: 'invalid_credentials',
      error_description: 'Invalid API key credentials'
    }, { status: 401 });
  }),

  // Token refresh
  http.post(`${AUTH_BASE}/oauth/token/refresh`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader?.includes('mock_refresh_token')) {
      return HttpResponse.json({
        access_token: 'new_access_token_123',
        refresh_token: 'new_refresh_token_123',
        expires_in: 3600
      });
    }
    
    return HttpResponse.json({
      error: 'invalid_token',
      error_description: 'Invalid refresh token'
    }, { status: 401 });
  })
];

export const apiHandlers = [
  // Build profiles
  http.get(`${API_BASE}/build/profiles`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader?.includes('Bearer')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check for valid tokens (tokens from successful auth)
    const validTokens = ['mock_access_token_123', 'mock_api_access_token_123', 'mock_success_token'];
    const token = authHeader.replace('Bearer ', '');
    
    // Allow dynamic tokens from MemoryAuth (mock_token_*) or specific valid tokens
    const isValidToken = validTokens.includes(token) || token.startsWith('mock_token_');
    
    if (!isValidToken) {
      return HttpResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    return HttpResponse.json([
      { id: 'profile_1', name: 'iOS Production', platform: 'iOS' },
      { id: 'profile_2', name: 'Android Production', platform: 'Android' }
    ]);
  }),

  // Organizations
  http.get(`${API_BASE}/organizations`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader?.includes('Bearer')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check for valid tokens (tokens from successful auth)
    const validTokens = ['mock_access_token_123', 'mock_api_access_token_123', 'mock_success_token'];
    const token = authHeader.replace('Bearer ', '');
    
    // Allow dynamic tokens from MemoryAuth (mock_token_*) or specific valid tokens
    const isValidToken = validTokens.includes(token) || token.startsWith('mock_token_');
    
    if (!isValidToken) {
      return HttpResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    return HttpResponse.json([
      { id: 'org_1', name: 'Test Organization', role: 'admin' },
      { id: 'org_2', name: 'Demo Org', role: 'member' }
    ]);
  }),

  // User info
  http.get(`${API_BASE}/user`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader?.includes('Bearer')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check for valid tokens (tokens from successful auth)
    const validTokens = ['mock_access_token_123', 'mock_api_access_token_123', 'mock_success_token'];
    const token = authHeader.replace('Bearer ', '');
    
    // Allow dynamic tokens from MemoryAuth (mock_token_*) or specific valid tokens
    const isValidToken = validTokens.includes(token) || token.startsWith('mock_token_');
    
    if (!isValidToken) {
      return HttpResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    return HttpResponse.json({
      id: 'user_123',
      email: 'test@example.com',
      name: 'Test User'
    });
  })
];

export const errorHandlers = [
  // Rate limiting
  http.get(`${API_BASE}/rate-limited`, () => {
    return HttpResponse.json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests'
    }, { status: 429 });
  }),

  // Server error
  http.get(`${API_BASE}/server-error`, () => {
    return HttpResponse.json({
      error: 'internal_server_error',
      message: 'Internal server error'
    }, { status: 500 });
  }),

  // Network timeout simulation
  http.get(`${API_BASE}/timeout`, async () => {
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10s timeout
    return HttpResponse.json({ message: 'This should timeout' });
  })
];

export const handlers = [
  ...authHandlers,
  ...apiHandlers,
  ...errorHandlers
];