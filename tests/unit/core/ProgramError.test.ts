import { describe, it, expect } from 'vitest'
import { ProgramError } from '../../../src/core/ProgramError.js'

describe('ProgramError', () => {
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
})