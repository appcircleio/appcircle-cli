import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCountryCodeParameter } from '../../../src/core/interactive-runner.ts';

describe('handleCountryCodeParameter', () => {
  const mockParam = { name: 'countryCode', type: 'SELECT' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should successfully handle country code selection', async () => {
      const mockCountries = [
        { alpha2: 'US', name: 'United States' },
        { alpha2: 'CA', name: 'Canada' },
        { alpha2: 'GB', name: 'United Kingdom' }
      ];
      const mockGetCountries = vi.fn().mockResolvedValue(mockCountries);

      const result = await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(result).toEqual({});
      expect(mockParam.params).toEqual([
        { name: 'US', message: 'United States' },
        { name: 'CA', message: 'Canada' },
        { name: 'GB', message: 'United Kingdom' }
      ]);
    });

    it('should format country params correctly with alpha2 codes', async () => {
      const mockCountries = [
        { alpha2: 'TR', name: 'Turkey' },
        { alpha2: 'FR', name: 'France' },
        { alpha2: 'DE', name: 'Germany' },
        { alpha2: 'JP', name: 'Japan' }
      ];
      const mockGetCountries = vi.fn().mockResolvedValue(mockCountries);

      await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(mockParam.params).toEqual([
        { name: 'TR', message: 'Turkey' },
        { name: 'FR', message: 'France' },
        { name: 'DE', message: 'Germany' },
        { name: 'JP', message: 'Japan' }
      ]);
    });

    it('should handle single country correctly', async () => {
      const mockCountries = [
        { alpha2: 'US', name: 'United States' }
      ];
      const mockGetCountries = vi.fn().mockResolvedValue(mockCountries);

      const result = await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(result).toEqual({});
      expect(mockParam.params).toEqual([
        { name: 'US', message: 'United States' }
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should handle getCountries throwing an exception', async () => {
      const mockGetCountries = vi.fn().mockRejectedValue(new Error('API Error'));

      const result = await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(result).toEqual({ isError: true });
    });

    it('should handle empty countries list gracefully', async () => {
      const mockGetCountries = vi.fn().mockResolvedValue([]);

      const result = await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(result).toEqual({});
      expect(mockParam.params).toEqual([]);
    });

    it('should handle null countries list gracefully', async () => {
      const mockGetCountries = vi.fn().mockResolvedValue(null);

      const result = await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(result).toEqual({});
      expect(mockParam.params).toEqual([]);
    });
  });

  describe('Data Handling', () => {
    it('should handle countries with missing alpha2 gracefully', async () => {
      const mockCountries = [
        { alpha2: 'US', name: 'United States' },
        { name: 'Missing Alpha2 Country' }, // missing alpha2
        { alpha2: 'CA', name: 'Canada' }
      ];
      const mockGetCountries = vi.fn().mockResolvedValue(mockCountries);

      await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(mockParam.params).toEqual([
        { name: 'US', message: 'United States' },
        { name: undefined, message: 'Missing Alpha2 Country' },
        { name: 'CA', message: 'Canada' }
      ]);
    });

    it('should handle countries with missing name gracefully', async () => {
      const mockCountries = [
        { alpha2: 'US', name: 'United States' },
        { alpha2: 'XX' }, // missing name
        { alpha2: 'CA', name: 'Canada' }
      ];
      const mockGetCountries = vi.fn().mockResolvedValue(mockCountries);

      await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(mockParam.params).toEqual([
        { name: 'US', message: 'United States' },
        { name: 'XX', message: 'undefined' },
        { name: 'CA', message: 'Canada' }
      ]);
    });

    it('should handle completely empty country objects', async () => {
      const mockCountries = [
        { alpha2: 'US', name: 'United States' },
        {}, // completely empty
        { alpha2: 'CA', name: 'Canada' }
      ];
      const mockGetCountries = vi.fn().mockResolvedValue(mockCountries);

      await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(mockParam.params).toEqual([
        { name: 'US', message: 'United States' },
        { name: undefined, message: 'undefined' },
        { name: 'CA', message: 'Canada' }
      ]);
    });

    it('should handle countries with special characters in names', async () => {
      const mockCountries = [
        { alpha2: 'CI', name: 'Côte d\'Ivoire' },
        { alpha2: 'CW', name: 'Curaçao' },
        { alpha2: 'RE', name: 'Réunion' }
      ];
      const mockGetCountries = vi.fn().mockResolvedValue(mockCountries);

      await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(mockParam.params).toEqual([
        { name: 'CI', message: 'Côte d\'Ivoire' },
        { name: 'CW', message: 'Curaçao' },
        { name: 'RE', message: 'Réunion' }
      ]);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle large numbers of countries', async () => {
      const mockCountries = Array.from({ length: 195 }, (_, i) => ({
        alpha2: `C${i.toString().padStart(2, '0')}`,
        name: `Country ${i}`
      }));
      const mockGetCountries = vi.fn().mockResolvedValue(mockCountries);

      const result = await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(result).toEqual({});
      expect(mockParam.params).toHaveLength(195);
      expect(mockParam.params[0]).toEqual({ name: 'C00', message: 'Country 0' });
      expect(mockParam.params[194]).toEqual({ name: 'C194', message: 'Country 194' });
    });

    it('should handle real-world country data', async () => {
      const realWorldCountries = [
        { alpha2: 'AF', name: 'Afghanistan' },
        { alpha2: 'AL', name: 'Albania' },
        { alpha2: 'DZ', name: 'Algeria' },
        { alpha2: 'AS', name: 'American Samoa' },
        { alpha2: 'AD', name: 'Andorra' },
        { alpha2: 'AO', name: 'Angola' },
        { alpha2: 'AI', name: 'Anguilla' },
        { alpha2: 'AQ', name: 'Antarctica' },
        { alpha2: 'AG', name: 'Antigua and Barbuda' },
        { alpha2: 'AR', name: 'Argentina' }
      ];
      const mockGetCountries = vi.fn().mockResolvedValue(realWorldCountries);

      const result = await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(result).toEqual({});
      expect(mockParam.params).toHaveLength(10);
      expect(mockParam.params[0]).toEqual({ name: 'AF', message: 'Afghanistan' });
      expect(mockParam.params[9]).toEqual({ name: 'AR', message: 'Argentina' });
    });

    it('should handle mixed data quality gracefully', async () => {
      const mixedData = [
        { alpha2: 'US', name: 'United States' }, // perfect
        { alpha2: 'XX' }, // missing name
        { name: 'No Code Country' }, // missing alpha2
        null, // null entry
        {}, // empty object
        { alpha2: 'CA', name: 'Canada' } // perfect
      ];
      const mockGetCountries = vi.fn().mockResolvedValue(mixedData);

      const result = await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(result).toEqual({});
      expect(mockParam.params).toHaveLength(6);
      expect(mockParam.params[0]).toEqual({ name: 'US', message: 'United States' });
      expect(mockParam.params[5]).toEqual({ name: 'CA', message: 'Canada' });
    });
  });

  describe('API Response Handling', () => {
    it('should handle API timeout gracefully', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API Timeout')), 100);
      });
      const mockGetCountries = vi.fn().mockReturnValue(timeoutPromise);

      const result = await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(result).toEqual({ isError: true });
    });

    it('should handle network errors gracefully', async () => {
      const mockGetCountries = vi.fn().mockRejectedValue(new Error('Network Error'));

      const result = await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(result).toEqual({ isError: true });
    });

    it('should handle malformed API response gracefully', async () => {
      const malformedData = [
        'not-an-object',
        { alpha2: 'US', name: 'United States' },
        42, // number instead of object
        { alpha2: 'CA', name: 'Canada' }
      ];
      const mockGetCountries = vi.fn().mockResolvedValue(malformedData);

      const result = await handleCountryCodeParameter(mockParam, mockGetCountries);

      expect(result).toEqual({});
      expect(mockParam.params).toHaveLength(4);
      // Should handle malformed entries gracefully
      expect(mockParam.params[1]).toEqual({ name: 'US', message: 'United States' });
      expect(mockParam.params[3]).toEqual({ name: 'CA', message: 'Canada' });
    });
  });
});