import { describe, it, expect } from 'vitest'
import { ProgramError } from '../../../src/core/ProgramError.js'

describe('ProgramError', () => {
  describe('Constructor', () => {
    it('should create error with message', () => {
      const message = 'Test error message'
      const error = new ProgramError(message)
      
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(ProgramError)
      expect(error.message).toBe(message)
    })

    it('should have correct name property', () => {
      const error = new ProgramError('test')
      
      expect(error.name).toBe('Error')
    })

    it('should maintain error stack trace', () => {
      const error = new ProgramError('Stack test')
      
      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('Stack test')
      expect(error.stack).toContain('ProgramError.test.ts')
    })
  })

  describe('Error properties', () => {
    it('should work with instanceof checks', () => {
      const error = new ProgramError('Instance test')
      
      expect(error instanceof Error).toBe(true)
      expect(error instanceof ProgramError).toBe(true)
    })

    it('should be serializable to JSON', () => {
      const message = 'Serialization test'
      const error = new ProgramError(message)
      
      // Error objects don't serialize well by default, test properties manually
      expect(error.message).toBe(message)
      
      // Test manual serialization
      const manualSerialization = {
        name: error.name,
        message: error.message
      }
      const serialized = JSON.stringify(manualSerialization)
      const parsed = JSON.parse(serialized)
      
      expect(parsed.message).toBe(message)
    })

    it('should preserve message property', () => {
      const messages = [
        'Simple message',
        'Message with symbols: !@#$%^&*()',
        'Multi-line\nmessage\nwith\nbreaks',
        'Unicode message: 🚀 中文 العربية',
        ''
      ]

      messages.forEach(message => {
        const error = new ProgramError(message)
        expect(error.message).toBe(message)
      })
    })
  })

  describe('Error throwing', () => {
    it('should be throwable and catchable', () => {
      const message = 'Thrown error'
      
      expect(() => {
        throw new ProgramError(message)
      }).toThrow(ProgramError)
      
      expect(() => {
        throw new ProgramError(message)
      }).toThrow(message)
    })

    it('should preserve error details when caught', () => {
      const message = 'Caught error'
      
      try {
        throw new ProgramError(message)
      } catch (error) {
        expect(error).toBeInstanceOf(ProgramError)
        expect((error as ProgramError).message).toBe(message)
      }
    })

    it('should be distinguishable from other Error types', () => {
      const programError = new ProgramError('Program error')
      const standardError = new Error('Standard error')
      
      expect(programError).toBeInstanceOf(ProgramError)
      expect(standardError).not.toBeInstanceOf(ProgramError)
      expect(programError).toBeInstanceOf(Error)
      expect(standardError).toBeInstanceOf(Error)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty message', () => {
      const error = new ProgramError('')
      
      expect(error.message).toBe('')
      expect(error).toBeInstanceOf(ProgramError)
    })

    it('should handle null message gracefully', () => {
      // TypeScript would prevent this, but testing runtime behavior
      const error = new ProgramError(null as any)
      
      expect(error.message).toBe('null')
    })

    it('should handle undefined message gracefully', () => {
      const error = new ProgramError(undefined as any)
      
      // In JavaScript, calling Error(undefined) results in empty string
      expect(error.message).toBe('')
    })

    it('should handle numeric message', () => {
      const error = new ProgramError(123 as any)
      
      expect(error.message).toBe('123')
    })

    it('should handle object message', () => {
      const obj = { key: 'value' }
      const error = new ProgramError(obj as any)
      
      expect(error.message).toBe('[object Object]')
    })
  })

  describe('Common CLI error scenarios', () => {
    it('should handle authentication errors', () => {
      const error = new ProgramError('Authentication failed: Invalid credentials')
      
      expect(error.message).toContain('Authentication failed')
    })

    it('should handle validation errors', () => {
      const error = new ProgramError('Validation error: Missing required parameter --profile-id')
      
      expect(error.message).toContain('Validation error')
      expect(error.message).toContain('--profile-id')
    })

    it('should handle file operation errors', () => {
      const error = new ProgramError('File not found: /path/to/missing/file.txt')
      
      expect(error.message).toContain('File not found')
    })

    it('should handle network errors', () => {
      const error = new ProgramError('Network error: Unable to connect to API server')
      
      expect(error.message).toContain('Network error')
    })

    it('should handle configuration errors', () => {
      const error = new ProgramError('Configuration error: Invalid API hostname format')
      
      expect(error.message).toContain('Configuration error')
    })
  })
})