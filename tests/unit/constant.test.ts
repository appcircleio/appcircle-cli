import { describe, it, expect, beforeEach } from 'vitest';
import {
  APPCIRCLE_COLOR,
  TaskStatus,
  BuildStatus,
  QueueItemStatus,
  AuthenticationTypes,
  OperatingSystems,
  PlatformTypes,
  PublishTypes,
  EnvironmentVariableTypes,
  IOSCertificateStoreTypes,
  PROGRAM_NAME,
  UNKNOWN_PARAM_VALUE,
  CURRENT_PARAM_VALUE,
  CountriesList,
  globalVariables
} from '../../src/constant';

describe('constant.ts', () => {
  describe('Basic Constants', () => {
    it('should have correct APPCIRCLE_COLOR', () => {
      expect(APPCIRCLE_COLOR).toBe('#ff8F34');
    });

    it('should have correct PROGRAM_NAME', () => {
      expect(PROGRAM_NAME).toBe('appcircle');
    });

    it('should have correct parameter values', () => {
      expect(UNKNOWN_PARAM_VALUE).toBe('-');
      expect(CURRENT_PARAM_VALUE).toBe('current');
    });
  });

  describe('TaskStatus Enum', () => {
    it('should have correct enum values', () => {
      expect(TaskStatus.BEGIN).toBe(1);
      expect(TaskStatus.CANCELED).toBe(2);
      expect(TaskStatus.COMPLETED).toBe(3);
    });

    it('should have all expected TaskStatus values', () => {
      const values = Object.values(TaskStatus);
      expect(values).toContain(1);
      expect(values).toContain(2);
      expect(values).toContain(3);
    });

    it('should have correct enum keys', () => {
      const keys = Object.keys(TaskStatus);
      expect(keys).toContain('BEGIN');
      expect(keys).toContain('CANCELED');
      expect(keys).toContain('COMPLETED');
    });
  });

  describe('BuildStatus Object', () => {
    it('should have correct build status mappings', () => {
      expect(BuildStatus['0']).toBe('Success');
      expect(BuildStatus['1']).toBe('Failed');
      expect(BuildStatus['2']).toBe('Canceled');
      expect(BuildStatus['3']).toBe('Timeout');
      expect(BuildStatus['90']).toBe('Waiting');
      expect(BuildStatus['91']).toBe('Running');
      expect(BuildStatus['92']).toBe('Completing');
      expect(BuildStatus['99']).toBe('Unknown');
      expect(BuildStatus['100']).toBe('Skipped');
      expect(BuildStatus['200']).toBe('NotStarted');
      expect(BuildStatus['201']).toBe('Stopped');
      expect(BuildStatus['202']).toBe('InProgress');
      expect(BuildStatus['203']).toBe('AwaitingResponse');
    });

    it('should have all expected build status keys', () => {
      const keys = Object.keys(BuildStatus);
      expect(keys).toContain('0');
      expect(keys).toContain('1');
      expect(keys).toContain('2');
      expect(keys).toContain('3');
      expect(keys).toContain('90');
      expect(keys).toContain('91');
      expect(keys).toContain('92');
      expect(keys).toContain('99');
      expect(keys).toContain('100');
      expect(keys).toContain('200');
      expect(keys).toContain('201');
      expect(keys).toContain('202');
      expect(keys).toContain('203');
    });
  });

  describe('QueueItemStatus Object', () => {
    it('should have correct queue status mappings', () => {
      expect(QueueItemStatus['0']).toBe('Waiting');
      expect(QueueItemStatus['1']).toBe('Running');
    });

    it('should have expected queue status keys', () => {
      const keys = Object.keys(QueueItemStatus);
      expect(keys).toHaveLength(2);
      expect(keys).toContain('0');
      expect(keys).toContain('1');
    });
  });

  describe('AuthenticationTypes Object', () => {
    it('should have correct authentication type mappings', () => {
      expect(AuthenticationTypes[1]).toBe('None');
      expect(AuthenticationTypes[2]).toBe('Individual Enrollment');
      expect(AuthenticationTypes[3]).toBe('Static Username and Password');
    });

    it('should have expected authentication type keys', () => {
      const keys = Object.keys(AuthenticationTypes);
      expect(keys).toContain('1');
      expect(keys).toContain('2');
      expect(keys).toContain('3');
    });
  });

  describe('OperatingSystems Object', () => {
    it('should have correct operating system mappings', () => {
      expect(OperatingSystems[0]).toBe('None');
      expect(OperatingSystems[1]).toBe('iOS');
      expect(OperatingSystems[2]).toBe('Android');
    });

    it('should have expected operating system keys', () => {
      const keys = Object.keys(OperatingSystems);
      expect(keys).toContain('0');
      expect(keys).toContain('1');
      expect(keys).toContain('2');
    });
  });

  describe('PlatformTypes Object', () => {
    it('should have correct platform type mappings', () => {
      expect(PlatformTypes[0]).toBe('None');
      expect(PlatformTypes[1]).toBe('Swift/Objective-C');
      expect(PlatformTypes[2]).toBe('Java/Kotlin');
      expect(PlatformTypes[3]).toBe('Smartface');
      expect(PlatformTypes[4]).toBe('React Native');
      expect(PlatformTypes[5]).toBe('Xamarin');
      expect(PlatformTypes[6]).toBe('Flutter');
    });

    it('should have all expected platform type keys', () => {
      const keys = Object.keys(PlatformTypes);
      expect(keys).toContain('0');
      expect(keys).toContain('1');
      expect(keys).toContain('2');
      expect(keys).toContain('3');
      expect(keys).toContain('4');
      expect(keys).toContain('5');
      expect(keys).toContain('6');
    });
  });

  describe('PublishTypes Object', () => {
    it('should have correct publish type mappings', () => {
      expect(PublishTypes[0]).toBe('None');
      expect(PublishTypes[1]).toBe('Beta');
      expect(PublishTypes[2]).toBe('Live');
    });

    it('should have expected publish type keys', () => {
      const keys = Object.keys(PublishTypes);
      expect(keys).toContain('0');
      expect(keys).toContain('1');
      expect(keys).toContain('2');
    });
  });

  describe('EnvironmentVariableTypes Object', () => {
    it('should have correct environment variable type mappings', () => {
      expect(EnvironmentVariableTypes.TEXT).toBe('text');
      expect(EnvironmentVariableTypes.FILE).toBe('file');
    });

    it('should have expected environment variable type keys', () => {
      const keys = Object.keys(EnvironmentVariableTypes);
      expect(keys).toContain('TEXT');
      expect(keys).toContain('FILE');
    });
  });

  describe('IOSCertificateStoreTypes Object', () => {
    it('should have correct certificate store type mappings', () => {
      expect(IOSCertificateStoreTypes['0']).toBe('Appcircle');
      expect(IOSCertificateStoreTypes['1']).toBe('App Store');
    });

    it('should have expected certificate store type keys', () => {
      const keys = Object.keys(IOSCertificateStoreTypes);
      expect(keys).toContain('0');
      expect(keys).toContain('1');
    });
  });

  describe('CountriesList Array', () => {
    it('should be an array', () => {
      expect(Array.isArray(CountriesList)).toBe(true);
    });

    it('should have expected length (countries)', () => {
      expect(CountriesList.length).toBeGreaterThan(200);
      expect(CountriesList.length).toBe(247);
    });

    it('should have correct format for country entries', () => {
      let arrayCount = 0;
      let stringCount = 0;
      
      CountriesList.forEach((country, _index) => {
        if (Array.isArray(country)) {
          arrayCount++;
          expect(typeof country[0]).toBe('string'); // Country name
          if (country.length === 2) {
            expect(typeof country[1]).toBe('string'); // Country code
          }
        } else {
          stringCount++;
          expect(typeof country).toBe('string');
        }
      });
      
      expect(arrayCount + stringCount).toBe(CountriesList.length);
      expect(arrayCount).toBeGreaterThan(200); // Most entries should be arrays
    });

    it('should contain specific countries', () => {
      const countryNames = CountriesList.map(country => Array.isArray(country) ? country[0] : (country as string).split(',')[0]);
      const countryCodes = CountriesList.map(country => Array.isArray(country) ? country[1] : (country as string).split(',')[1]);

      expect(countryNames).toContain('United States');
      expect(countryNames).toContain('Turkey');
      expect(countryNames).toContain('Germany');
      expect(countryNames).toContain('Japan');
      
      expect(countryCodes).toContain('US');
      expect(countryCodes).toContain('TR');
      expect(countryCodes).toContain('DE');
      expect(countryCodes).toContain('JP');
    });

    it('should have unique country codes', () => {
      const countryCodes = CountriesList.map(country => Array.isArray(country) ? country[1] : (country as string).split(',')[1]);
      const uniqueCodes = new Set(countryCodes.filter(code => code)); // Filter out undefined
      expect(uniqueCodes.size).toBe(countryCodes.filter(code => code).length);
    });

    it('should have valid country code format', () => {
      CountriesList.forEach(country => {
        const code = Array.isArray(country) ? country[1] : (country as string).split(',')[1];
        if (code) {
          expect(code).toMatch(/^[A-Z]{2}$/); // Two uppercase letters
        }
      });
    });

    it('should contain common countries with correct codes', () => {
      const countryMap = new Map(CountriesList.map(country => {
        if (Array.isArray(country)) {
          return [country[0], country[1]];
        } else {
          const parts = (country as string).split(',');
          return [parts[0], parts[1]];
        }
      }));
      
      expect(countryMap.get('Afghanistan')).toBe('AF');
      expect(countryMap.get('Brazil')).toBe('BR');
      expect(countryMap.get('China')).toBe('CN');
      expect(countryMap.get('France')).toBe('FR');
      expect(countryMap.get('India')).toBe('IN');
      expect(countryMap.get('United Kingdom')).toBe('GB');
    });
  });

  describe('globalVariables', () => {
    beforeEach(() => {
      // Clear globalVariables before each test
      Object.keys(globalVariables).forEach(key => {
        delete globalVariables[key];
      });
    });

    it('should be an empty object initially', () => {
      expect(globalVariables).toEqual({});
      expect(typeof globalVariables).toBe('object');
    });

    it('should be mutable and allow setting values', () => {
      globalVariables['testKey'] = 'testValue';
      expect(globalVariables['testKey']).toBe('testValue');
    });

    it('should allow multiple key-value pairs', () => {
      globalVariables['key1'] = 'value1';
      globalVariables['key2'] = 'value2';
      
      expect(globalVariables['key1']).toBe('value1');
      expect(globalVariables['key2']).toBe('value2');
      expect(Object.keys(globalVariables)).toHaveLength(2);
    });

    it('should allow updating existing values', () => {
      globalVariables['updateKey'] = 'initialValue';
      expect(globalVariables['updateKey']).toBe('initialValue');
      
      globalVariables['updateKey'] = 'updatedValue';
      expect(globalVariables['updateKey']).toBe('updatedValue');
    });

    it('should allow deleting keys', () => {
      globalVariables['deleteKey'] = 'deleteValue';
      expect(globalVariables['deleteKey']).toBe('deleteValue');
      
      delete globalVariables['deleteKey'];
      expect(globalVariables['deleteKey']).toBeUndefined();
      expect('deleteKey' in globalVariables).toBe(false);
    });
  });

  describe('Object Properties and Immutability', () => {
    it('should have immutable constant values', () => {
      expect(() => {
        // @ts-ignore - Testing runtime immutability
        APPCIRCLE_COLOR = '#000000';
      }).toThrow();
    });

    it('should have object values accessible by key', () => {
      expect(BuildStatus['0']).toBeDefined();
      expect(OperatingSystems[1]).toBeDefined();
      expect(PlatformTypes[4]).toBeDefined();
    });

    it('should handle undefined keys gracefully', () => {
      expect(BuildStatus['999']).toBeUndefined();
      expect(OperatingSystems[99]).toBeUndefined();
      expect(PlatformTypes[-1]).toBeUndefined();
    });
  });

  describe('Type Consistency', () => {
    it('should have consistent string values in mappings', () => {
      Object.values(BuildStatus).forEach(value => {
        expect(typeof value).toBe('string');
      });

      Object.values(OperatingSystems).forEach(value => {
        expect(typeof value).toBe('string');
      });

      Object.values(PlatformTypes).forEach(value => {
        expect(typeof value).toBe('string');
      });
    });

    it('should have numeric keys for most mappings', () => {
      Object.keys(BuildStatus).forEach(key => {
        expect(!isNaN(Number(key))).toBe(true);
      });

      Object.keys(OperatingSystems).forEach(key => {
        expect(!isNaN(Number(key))).toBe(true);
      });

      Object.keys(PlatformTypes).forEach(key => {
        expect(!isNaN(Number(key))).toBe(true);
      });
    });
  });
});