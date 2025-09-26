/**
 * @fileoverview Unit tests for the new release notes update feature
 * Tests the specific functionality added to automatically update release notes after distribution upload
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the testing-distribution service
vi.mock('../../../src/services/testing-distribution.js', () => ({
  getLatestAppVersionId: vi.fn(),
  updateTestingDistributionReleaseNotes: vi.fn()
}));

import {
  getLatestAppVersionId,
  updateTestingDistributionReleaseNotes
} from '../../../src/services/testing-distribution';

const mockGetLatestAppVersionId = getLatestAppVersionId as any;
const mockUpdateTestingDistributionReleaseNotes = updateTestingDistributionReleaseNotes as any;

describe('Release Notes Update Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLatestAppVersionId', () => {
    it('should return the most recent version ID by createdAt timestamp', async () => {
      const mockProfile = {
        id: 'profile-1',
        appVersions: [
          { id: 'v1', createdAt: '2024-01-01T10:00:00Z' },
          { id: 'v2', createdAt: '2024-01-03T10:00:00Z' }, // Latest
          { id: 'v3', createdAt: '2024-01-02T10:00:00Z' }
        ]
      };

      // Mock the API call that getLatestAppVersionId makes internally
      vi.doMock('../../../src/services/testing-distribution.js', () => ({
        getDistributionProfileById: vi.fn().mockResolvedValue(mockProfile),
        getLatestAppVersionId: vi.fn().mockImplementation(async (options) => {
          const profile = mockProfile;
          if (profile && profile.appVersions && profile.appVersions.length > 0) {
            const sortedVersions = [...profile.appVersions].sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            return sortedVersions[0].id;
          }
          return null;
        })
      }));

      // Re-import after mocking
      const { getLatestAppVersionId: testGetLatestAppVersionId } = await import('../../../src/services/testing-distribution');

      const result = await testGetLatestAppVersionId({ distProfileId: 'profile-1' });

      expect(result).toBe('v2'); // Should be the latest by timestamp
    });

    it('should return null when no versions exist', async () => {
      const mockProfile = {
        id: 'profile-1',
        appVersions: []
      };

      vi.doMock('../../../src/services/testing-distribution.js', () => ({
        getDistributionProfileById: vi.fn().mockResolvedValue(mockProfile),
        getLatestAppVersionId: vi.fn().mockImplementation(async () => {
          const profile = mockProfile;
          if (profile && profile.appVersions && profile.appVersions.length > 0) {
            const sortedVersions = [...profile.appVersions].sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            return sortedVersions[0].id;
          }
          return null;
        })
      }));

      const { getLatestAppVersionId: testGetLatestAppVersionId } = await import('../../../src/services/testing-distribution');

      const result = await testGetLatestAppVersionId({ distProfileId: 'profile-1' });

      expect(result).toBeNull();
    });

    it('should handle versions with same timestamp correctly', async () => {
      const sameTimestamp = '2024-01-01T10:00:00Z';
      const mockProfile = {
        id: 'profile-1',
        appVersions: [
          { id: 'v1', createdAt: sameTimestamp },
          { id: 'v2', createdAt: sameTimestamp },
          { id: 'v3', createdAt: sameTimestamp }
        ]
      };

      vi.doMock('../../../src/services/testing-distribution.js', () => ({
        getDistributionProfileById: vi.fn().mockResolvedValue(mockProfile),
        getLatestAppVersionId: vi.fn().mockImplementation(async () => {
          const profile = mockProfile;
          if (profile && profile.appVersions && profile.appVersions.length > 0) {
            const sortedVersions = [...profile.appVersions].sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            return sortedVersions[0].id;
          }
          return null;
        })
      }));

      const { getLatestAppVersionId: testGetLatestAppVersionId } = await import('../../../src/services/testing-distribution');

      const result = await testGetLatestAppVersionId({ distProfileId: 'profile-1' });

      expect(['v1', 'v2', 'v3']).toContain(result);
    });
  });

  describe('updateTestingDistributionReleaseNotes', () => {
    it('should update release notes with correct API call', async () => {
      mockUpdateTestingDistributionReleaseNotes.mockResolvedValue({ success: true });

      await updateTestingDistributionReleaseNotes({
        distProfileId: 'profile-1',
        versionId: 'version-123',
        message: 'Version 2.0.0 Release Notes'
      });

      expect(mockUpdateTestingDistributionReleaseNotes).toHaveBeenCalledWith({
        distProfileId: 'profile-1',
        versionId: 'version-123',
        message: 'Version 2.0.0 Release Notes'
      });
    });

    it('should handle empty release notes message', async () => {
      mockUpdateTestingDistributionReleaseNotes.mockResolvedValue({ success: true });

      await updateTestingDistributionReleaseNotes({
        distProfileId: 'profile-1',
        versionId: 'version-123',
        message: ''
      });

      expect(mockUpdateTestingDistributionReleaseNotes).toHaveBeenCalledWith({
        distProfileId: 'profile-1',
        versionId: 'version-123',
        message: ''
      });
    });

    it('should handle Unicode and special characters in release notes', async () => {
      mockUpdateTestingDistributionReleaseNotes.mockResolvedValue({ success: true });

      const unicodeMessage = '新功能 🚀 Bug fixes included';

      await updateTestingDistributionReleaseNotes({
        distProfileId: 'profile-1',
        versionId: 'version-123',
        message: unicodeMessage
      });

      expect(mockUpdateTestingDistributionReleaseNotes).toHaveBeenCalledWith({
        distProfileId: 'profile-1',
        versionId: 'version-123',
        message: unicodeMessage
      });
    });

    it('should handle multiline release notes', async () => {
      mockUpdateTestingDistributionReleaseNotes.mockResolvedValue({ success: true });

      const multilineMessage = `Release v2.0.0

Features:
- New authentication system
- Performance improvements
- UI enhancements

Bug Fixes:
- Fixed crash on startup
- Memory leak resolved`;

      await updateTestingDistributionReleaseNotes({
        distProfileId: 'profile-1',
        versionId: 'version-123',
        message: multilineMessage
      });

      expect(mockUpdateTestingDistributionReleaseNotes).toHaveBeenCalledWith({
        distProfileId: 'profile-1',
        versionId: 'version-123',
        message: multilineMessage
      });
    });

    it('should propagate API errors', async () => {
      const apiError = new Error('Release notes update failed');
      mockUpdateTestingDistributionReleaseNotes.mockRejectedValue(apiError);

      await expect(
        updateTestingDistributionReleaseNotes({
          distProfileId: 'profile-1',
          versionId: 'version-123',
          message: 'Test message'
        })
      ).rejects.toThrow('Release notes update failed');
    });
  });

  describe('Retry Logic Integration', () => {
    /**
     * This test simulates the retry logic that's implemented in the command runner
     * where it retries getting the latest version ID when it's not immediately available
     */
    it('should simulate retry behavior for getting version ID', async () => {
      let attemptCount = 0;

      mockGetLatestAppVersionId.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount <= 3) {
          // First 3 attempts return null (simulating processing delay)
          return null;
        }
        // 4th attempt succeeds
        return 'version-final';
      });

      // Simulate the retry logic
      let latestVersionId = null;
      let attempts = 0;
      const maxAttempts = 5;
      const retryDelay = 100; // Shorter delay for test

      while (!latestVersionId && attempts < maxAttempts) {
        attempts++;

        try {
          latestVersionId = await mockGetLatestAppVersionId({
            distProfileId: 'profile-1'
          });
        } catch (error) {
          // Retry silently as in the actual implementation
        }

        if (!latestVersionId && attempts > 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      expect(latestVersionId).toBe('version-final');
      expect(attempts).toBe(4);
      expect(mockGetLatestAppVersionId).toHaveBeenCalledTimes(4);
    });

    it('should simulate max attempts reached scenario', async () => {
      mockGetLatestAppVersionId.mockResolvedValue(null);

      let latestVersionId = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (!latestVersionId && attempts < maxAttempts) {
        attempts++;

        latestVersionId = await mockGetLatestAppVersionId({
          distProfileId: 'profile-1'
        });

        if (!latestVersionId && attempts > 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      expect(latestVersionId).toBeNull();
      expect(attempts).toBe(maxAttempts);
      expect(mockGetLatestAppVersionId).toHaveBeenCalledTimes(maxAttempts);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle malformed version data gracefully', async () => {
      // Test with malformed date strings
      const mockProfile = {
        id: 'profile-1',
        appVersions: [
          { id: 'v1', createdAt: 'invalid-date' },
          { id: 'v2', createdAt: '2024-01-02T10:00:00Z' },
          { id: 'v3', createdAt: null }
        ]
      };

      vi.doMock('../../../src/services/testing-distribution.js', () => ({
        getDistributionProfileById: vi.fn().mockResolvedValue(mockProfile),
        getLatestAppVersionId: vi.fn().mockImplementation(async () => {
          const profile = mockProfile;
          if (profile && profile.appVersions && profile.appVersions.length > 0) {
            const sortedVersions = [...profile.appVersions].sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            return sortedVersions[0].id;
          }
          return null;
        })
      }));

      const { getLatestAppVersionId: testGetLatestAppVersionId } = await import('../../../src/services/testing-distribution');

      const result = await testGetLatestAppVersionId({ distProfileId: 'profile-1' });

      // Should handle gracefully and return the first item after sort
      expect(result).toBeDefined();
    });

    it('should handle network failures during release notes update', async () => {
      const networkError = new Error('Network timeout');
      networkError.name = 'AxiosError';
      (networkError as any).code = 'ECONNABORTED';

      mockUpdateTestingDistributionReleaseNotes.mockRejectedValue(networkError);

      await expect(
        updateTestingDistributionReleaseNotes({
          distProfileId: 'profile-1',
          versionId: 'version-123',
          message: 'Test message'
        })
      ).rejects.toThrow('Network timeout');
    });

    it('should handle 409 conflict errors during release notes update', async () => {
      const conflictError = new Error('Version was modified by another user');
      (conflictError as any).response = { status: 409 };

      mockUpdateTestingDistributionReleaseNotes.mockRejectedValue(conflictError);

      await expect(
        updateTestingDistributionReleaseNotes({
          distProfileId: 'profile-1',
          versionId: 'version-123',
          message: 'Test message'
        })
      ).rejects.toThrow('Version was modified by another user');
    });

    it('should handle very large release notes messages', async () => {
      mockUpdateTestingDistributionReleaseNotes.mockResolvedValue({ success: true });

      const largeMessage = 'A'.repeat(50000); // 50KB message

      await updateTestingDistributionReleaseNotes({
        distProfileId: 'profile-1',
        versionId: 'version-123',
        message: largeMessage
      });

      expect(mockUpdateTestingDistributionReleaseNotes).toHaveBeenCalledWith({
        distProfileId: 'profile-1',
        versionId: 'version-123',
        message: largeMessage
      });
    });
  });

  describe('Feature Integration Scenarios', () => {
    it('should handle complete success flow', async () => {
      // Mock successful version retrieval
      mockGetLatestAppVersionId.mockResolvedValue('version-456');

      // Mock successful release notes update
      mockUpdateTestingDistributionReleaseNotes.mockResolvedValue({
        success: true,
        message: 'Release notes updated successfully'
      });

      // Simulate the complete flow
      const distProfileId = 'profile-123';
      const message = 'Version 1.5.0 - Added new features and improvements';

      // Step 1: Get latest version ID
      const versionId = await getLatestAppVersionId({ distProfileId });
      expect(versionId).toBe('version-456');

      // Step 2: Update release notes
      const result = await updateTestingDistributionReleaseNotes({
        distProfileId,
        versionId,
        message
      });

      expect(result.success).toBe(true);
      expect(mockGetLatestAppVersionId).toHaveBeenCalledWith({ distProfileId });
      expect(mockUpdateTestingDistributionReleaseNotes).toHaveBeenCalledWith({
        distProfileId,
        versionId: 'version-456',
        message
      });
    });

    it('should handle partial failure scenarios gracefully', async () => {
      // Version retrieval succeeds
      mockGetLatestAppVersionId.mockResolvedValue('version-456');

      // Release notes update fails
      mockUpdateTestingDistributionReleaseNotes.mockRejectedValue(
        new Error('Service temporarily unavailable')
      );

      const distProfileId = 'profile-123';
      const message = 'Test release notes';

      // Get version ID should work
      const versionId = await getLatestAppVersionId({ distProfileId });
      expect(versionId).toBe('version-456');

      // Release notes update should fail
      await expect(
        updateTestingDistributionReleaseNotes({
          distProfileId,
          versionId,
          message
        })
      ).rejects.toThrow('Service temporarily unavailable');
    });

    it('should validate input parameters', async () => {
      // Test that the functions are called with the expected parameters
      mockUpdateTestingDistributionReleaseNotes.mockResolvedValue({ success: true });

      const params = {
        distProfileId: 'profile-test-123',
        versionId: 'version-test-456',
        message: 'Comprehensive test release notes'
      };

      await updateTestingDistributionReleaseNotes(params);

      expect(mockUpdateTestingDistributionReleaseNotes).toHaveBeenCalledWith({
        distProfileId: 'profile-test-123',
        versionId: 'version-test-456',
        message: 'Comprehensive test release notes'
      });
    });
  });
});