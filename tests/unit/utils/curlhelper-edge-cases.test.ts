import { describe, it, expect } from 'vitest'
import CurlHelper from '../../../src/utils/curlhelper'

describe('CurlHelper edge cases', () => {
  it('skips inherited header properties of the method-specific headers', () => {
    const methodHeaders = Object.create({ 'X-Inherited': 'proto' })
    methodHeaders.Accept = 'application/json'
    const helper = new CurlHelper({
      method: 'get',
      url: 'https://api.example.test/items',
      headers: { common: { 'X-Common': 'c' }, get: methodHeaders } as any
    })

    expect(helper.getHeaders()).toBe('-H "Accept:application/json"')
  })

  it('includes the body when the request has no method', () => {
    const helper = new CurlHelper({
      url: 'https://api.example.test/items',
      headers: {} as any,
      data: { name: 'x' }
    })

    expect(helper.getBody()).toBe(`--data '{"name":"x"}'`)
    expect(helper.generateCommand()).toBe(`curl -X UNKNOWN "https://api.example.test/items" --data '{"name":"x"}'`)
  })
})
