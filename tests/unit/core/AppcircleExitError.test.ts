import { describe, it, expect } from 'vitest'
import { AppcircleExitError } from '../../../src/core/AppcircleExitError.js'

describe('AppcircleExitError', () => {
  describe('Constructor', () => {
    it('should create error with message and default code 1', () => {
      const message = 'Test error message'
      const error = new AppcircleExitError(message)
      
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(AppcircleExitError)
      expect(error.message).toBe(message)
      expect(error.code).toBe(1)
    })

    it('should create error with message and custom code', () => {
      const message = 'Custom error'
      const code = 42
      const error = new AppcircleExitError(message, code)
      
      expect(error.message).toBe(message)
      expect(error.code).toBe(code)
    })

    it('should create error with code 0 for successful exit', () => {
      const message = 'Success'
      const code = 0
      const error = new AppcircleExitError(message, code)
      
      expect(error.message).toBe(message)
      expect(error.code).toBe(code)
    })

    it('should have correct name property', () => {
      const error = new AppcircleExitError('test')
      
      expect(error.name).toBe('AppcircleExitError')
    })
  })

  describe('Error properties', () => {
    it('should maintain error stack trace', () => {
      const error = new AppcircleExitError('Stack test')
      
      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('Stack test')
      
      // Test toString format
      expect(String(error)).toContain('AppcircleExitError: Stack test')
      
      // Test first stack line format (platform independent)
      const firstStackLine = error.stack?.split('\\n')[0] ?? ''
      expect(firstStackLine).toContain('AppcircleExitError: Stack test')
    })

    it('should be serializable to JSON', () => {
      const message = 'Serialization test'
      const code = 5
      const error = new AppcircleExitError(message, code)
      
      // Error objects don't serialize well by default, but we can test the properties exist
      expect(error.message).toBe(message)
      expect(error.name).toBe('AppcircleExitError')
      expect(error.code).toBe(code)
      
      // Test manual serialization
      const manualSerialization = {
        name: error.name,
        message: error.message,
        code: error.code
      }
      const serialized = JSON.stringify(manualSerialization)
      const parsed = JSON.parse(serialized)
      
      expect(parsed.message).toBe(message)
      expect(parsed.name).toBe('AppcircleExitError')
      expect(parsed.code).toBe(code)
    })

    it('should work with instanceof checks', () => {
      const error = new AppcircleExitError('Instance test')
      
      expect(error instanceof Error).toBe(true)
      expect(error instanceof AppcircleExitError).toBe(true)
    })

    it('should have own properties correctly set', () => {
      const error = new AppcircleExitError('Property test', 42)
      
      // Test that properties are own properties, not inherited
      expect(error.hasOwnProperty('name')).toBe(true)
      expect(error.hasOwnProperty('message')).toBe(true)
      expect(error.hasOwnProperty('code')).toBe(true)
      
      // Test property descriptors
      const codeDescriptor = Object.getOwnPropertyDescriptor(error, 'code')
      expect(codeDescriptor).toBeDefined()
      expect(codeDescriptor?.value).toBe(42)
      expect(codeDescriptor?.writable).toBe(true)
      
      const nameDescriptor = Object.getOwnPropertyDescriptor(error, 'name')
      expect(nameDescriptor).toBeDefined()
      expect(nameDescriptor?.value).toBe('AppcircleExitError')
    })
  })

  describe('Exit codes', () => {
    it('should handle standard exit codes', () => {
      const successError = new AppcircleExitError('Success', 0)
      const generalError = new AppcircleExitError('General error', 1)
      const invalidUsage = new AppcircleExitError('Invalid usage', 2)
      const authError = new AppcircleExitError('Auth error', 3)
      
      expect(successError.code).toBe(0)
      expect(generalError.code).toBe(1)
      expect(invalidUsage.code).toBe(2)
      expect(authError.code).toBe(3)
    })

    it('should handle negative exit codes', () => {
      const error = new AppcircleExitError('Negative code', -1)
      
      expect(error.code).toBe(-1)
    })

    it('should handle large exit codes', () => {
      const error = new AppcircleExitError('Large code', 255)
      
      expect(error.code).toBe(255)
    })

    it('should handle NaN as code', () => {
      const error = new AppcircleExitError('NaN code', NaN)
      
      expect(error.code).toBeNaN()
    })

    it('should handle Infinity as code', () => {
      const posInfError = new AppcircleExitError('Positive Infinity', Infinity)
      const negInfError = new AppcircleExitError('Negative Infinity', -Infinity)
      
      expect(posInfError.code).toBe(Infinity)
      expect(negInfError.code).toBe(-Infinity)
    })

    it('should handle decimal exit codes', () => {
      const error = new AppcircleExitError('Decimal code', 2.5)
      
      expect(error.code).toBe(2.5)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty message', () => {
      const error = new AppcircleExitError('')
      
      expect(error.message).toBe('')
      expect(error.code).toBe(1)
    })

    it('should handle null message gracefully', () => {
      // TypeScript would prevent this, but testing runtime behavior
      const error = new AppcircleExitError(null as any)
      
      expect(error.message).toBe('null')
      expect(error.code).toBe(1)
    })

    it('should handle undefined code as default', () => {
      const error = new AppcircleExitError('test', undefined as any)
      
      expect(error.code).toBe(1)
    })

    it('should handle zero as valid code', () => {
      const error = new AppcircleExitError('test', 0)
      
      expect(error.code).toBe(0)
    })
  })

  describe('Message type conversions', () => {
    it('should handle number message', () => {
      const error = new AppcircleExitError(42 as any)
      
      expect(error.message).toBe('42')
      expect(error.code).toBe(1)
    })

    it('should handle boolean message', () => {
      const trueError = new AppcircleExitError(true as any)
      const falseError = new AppcircleExitError(false as any)
      
      expect(trueError.message).toBe('true')
      expect(falseError.message).toBe('false')
    })

    it('should handle object message', () => {
      const testObj = { test: 'value' }
      const error = new AppcircleExitError(testObj as any)
      
      expect(error.message).toBe('[object Object]')
    })

    it('should handle array message', () => {
      const testArray = ['item1', 'item2']
      const error = new AppcircleExitError(testArray as any)
      
      expect(error.message).toBe('item1,item2')
    })

    it('should handle function message', () => {
      const testFunction = () => 'test'
      const error = new AppcircleExitError(testFunction as any)
      
      expect(error.message).toBe('() => "test"')
      expect(error.code).toBe(1)
    })
  })

  describe('Error throwing', () => {
    it('should be throwable and catchable', () => {
      const message = 'Thrown error'
      const code = 10
      
      expect(() => {
        throw new AppcircleExitError(message, code)
      }).toThrow(AppcircleExitError)
      
      try {
        throw new AppcircleExitError(message, code)
      } catch (error) {
        expect(error).toBeInstanceOf(AppcircleExitError)
        expect((error as AppcircleExitError).message).toBe(message)
        expect((error as AppcircleExitError).code).toBe(code)
      }
    })

    it('should preserve error details when re-thrown', () => {
      const originalMessage = 'Original error'
      const originalCode = 5
      
      try {
        try {
          throw new AppcircleExitError(originalMessage, originalCode)
        } catch (error) {
          // Re-throw the same error
          throw error
        }
      } catch (error) {
        expect(error).toBeInstanceOf(AppcircleExitError)
        expect((error as AppcircleExitError).message).toBe(originalMessage)
        expect((error as AppcircleExitError).code).toBe(originalCode)
      }
    })
  })
})