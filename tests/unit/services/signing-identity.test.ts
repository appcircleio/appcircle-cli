import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import FormData from 'form-data'

// Mock dependencies first
vi.mock('fs')
vi.mock('form-data')

vi.mock('../../../src/services/api.js', () => ({
  appcircleApi: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  },
  getHeaders: vi.fn(() => ({
    'Authorization': 'Bearer test-token',
    'Content-Type': 'application/json'
  }))
}))

// Import functions after mocking
import {
  getiOSP12Certificates,
  getAndroidKeystores,
  uploadAndroidKeystoreFile,
  generateNewKeystore,
  getCertificateDetailById,
  getKeystoreDetailById,
  downloadKeystoreById,
  downloadCertificateById,
  removeCSRorP12CertificateById,
  removeKeystore,
  getiOSCSRCertificates,
  getProvisioningProfiles,
  downloadProvisioningProfileById,
  getProvisioningProfileDetailById,
  uploadProvisioningProfile,
  removeProvisioningProfile,
  uploadP12Certificate,
  createCSRCertificateRequest
} from '../../../src/services/signing-identity'

import { appcircleApi, getHeaders } from '../../../src/services/api'

const mockAppcircleApi = appcircleApi as any
const mockGetHeaders = getHeaders as any
const mockFs = vi.mocked(fs)
const MockFormData = vi.mocked(FormData)

describe('Signing Identity Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    MockFormData.prototype.append = vi.fn()
    MockFormData.prototype.getHeaders = vi.fn(() => ({
      'content-type': 'multipart/form-data; boundary=test'
    }))
  })

  describe('iOS P12 Certificates', () => {
    describe('getiOSP12Certificates', () => {
      it('should fetch and transform P12 certificates with extension property', async () => {
        const mockCerts = [
          { id: 'cert1', name: 'iOS Cert 1' },
          { id: 'cert2', name: 'iOS Cert 2' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockCerts })

        const result = await getiOSP12Certificates()

        expect(result).toHaveLength(2)
        expect(result[0]).toHaveProperty('extension', 'P12')
        expect(result[1]).toHaveProperty('extension', 'P12')
        expect(result[0]).toMatchObject(mockCerts[0])
        
        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'signing-identity/v2/certificates',
          { headers: expect.objectContaining({ 'Authorization': 'Bearer test-token' }) }
        )
      })

      it('should handle empty certificates list', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })
        
        const result = await getiOSP12Certificates()
        
        expect(result).toEqual([])
      })

      it('should handle null/undefined data gracefully', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: null })
        
        const result = await getiOSP12Certificates()
        
        expect(result).toBeUndefined()
      })

      it('should propagate API errors', async () => {
        const apiError = new Error('API Error')
        mockAppcircleApi.get.mockRejectedValue(apiError)

        await expect(getiOSP12Certificates()).rejects.toThrow('API Error')
      })
    })

    describe('uploadP12Certificate', () => {
      it('should upload P12 with correct FormData structure', async () => {
        const mockStream = 'mock-file-stream'
        mockFs.createReadStream.mockReturnValue(mockStream as any)
        
        const mockResponse = { id: 'cert123', name: 'uploaded-cert' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await uploadP12Certificate({ 
          path: '/path/cert.p12', 
          password: 'secret123' 
        })

        expect(mockFs.createReadStream).toHaveBeenCalledWith('/path/cert.p12')
        expect(MockFormData.prototype.append).toHaveBeenCalledWith('binary', mockStream)
        expect(MockFormData.prototype.append).toHaveBeenCalledWith('password', 'secret123')
        
        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'signing-identity/v2/certificates',
          expect.any(FormData),
          expect.objectContaining({
            maxBodyLength: Infinity,
            headers: expect.objectContaining({
              'content-type': 'multipart/form-data; boundary=test'
            })
          })
        )
        
        expect(result).toEqual(mockResponse)
      })

      it('should handle file not found error', async () => {
        const fileError = new Error('ENOENT: no such file or directory')
        mockFs.createReadStream.mockImplementation(() => { throw fileError })

        await expect(uploadP12Certificate({ 
          path: '/nonexistent.p12', 
          password: 'secret' 
        })).rejects.toThrow('ENOENT')
      })

      it('should handle invalid password error', async () => {
        const mockStream = 'mock-stream'
        mockFs.createReadStream.mockReturnValue(mockStream as any)
        
        const passwordError = new Error('Invalid password')
        mockAppcircleApi.post.mockRejectedValue(passwordError)

        await expect(uploadP12Certificate({ 
          path: '/cert.p12', 
          password: 'wrong' 
        })).rejects.toThrow('Invalid password')
      })

      it('should handle file upload with special characters in path', async () => {
        const mockStream = 'mock-stream'
        mockFs.createReadStream.mockReturnValue(mockStream as any)
        
        const mockResponse = { id: 'cert123' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const specialPath = '/path with spaces/cert (v1.0).p12'
        await uploadP12Certificate({ path: specialPath, password: 'secret' })

        expect(mockFs.createReadStream).toHaveBeenCalledWith(specialPath)
      })
    })

    describe('getCertificateDetailById', () => {
      it('should fetch certificate details by ID', async () => {
        const mockCertificate = { 
          id: 'cert123', 
          name: 'Test Certificate',
          validUntil: '2024-12-31' 
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockCertificate })

        const result = await getCertificateDetailById({ 
          certificateBundleId: 'cert123' 
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'signing-identity/v2/certificates/cert123',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockCertificate)
      })

      it('should handle 404 for non-existent certificate', async () => {
        const notFoundError = new Error('Certificate not found')
        mockAppcircleApi.get.mockRejectedValue(notFoundError)

        await expect(getCertificateDetailById({ 
          certificateBundleId: 'non-existent' 
        })).rejects.toThrow('Certificate not found')
      })
    })
  })

  describe('Android Keystore Operations', () => {
    describe('getAndroidKeystores', () => {
      it('should fetch Android keystores successfully', async () => {
        const mockKeystores = [
          { id: 'ks1', name: 'Release Keystore' },
          { id: 'ks2', name: 'Debug Keystore' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockKeystores })

        const result = await getAndroidKeystores()

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'signing-identity/v2/keystores',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockKeystores)
      })

      it('should handle empty keystores list', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })
        
        const result = await getAndroidKeystores()
        
        expect(result).toEqual([])
      })
    })

    describe('uploadAndroidKeystoreFile', () => {
      it('should upload keystore with all required fields', async () => {
        const mockStream = 'mock-keystore-stream'
        mockFs.createReadStream.mockReturnValue(mockStream as any)
        
        const mockResponse = { id: 'ks123', name: 'uploaded-keystore' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await uploadAndroidKeystoreFile({
          path: '/keystore.jks',
          name: 'test-keystore',
          password: 'store_pass',
          aliasPassword: 'alias_pass'
        })

        expect(MockFormData.prototype.append).toHaveBeenCalledWith('Binary', mockStream)
        expect(MockFormData.prototype.append).toHaveBeenCalledWith('KeystorePassword', 'store_pass')
        expect(MockFormData.prototype.append).toHaveBeenCalledWith('AliasPassword', 'alias_pass')
        
        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'signing-identity/v2/keystores/binary',
          expect.any(FormData),
          expect.objectContaining({
            maxBodyLength: Infinity,
            headers: expect.objectContaining({
              'content-type': 'multipart/form-data; boundary=test'
            })
          })
        )
        
        expect(result).toEqual(mockResponse)
      })

      it('should handle keystore file upload failure', async () => {
        const mockStream = 'mock-stream'
        mockFs.createReadStream.mockReturnValue(mockStream as any)
        
        const uploadError = new Error('Keystore upload failed')
        mockAppcircleApi.post.mockRejectedValue(uploadError)

        await expect(uploadAndroidKeystoreFile({
          path: '/keystore.jks',
          name: 'test',
          password: 'pass',
          aliasPassword: 'alias'
        })).rejects.toThrow('Keystore upload failed')
      })

      it('should handle invalid keystore format error', async () => {
        const mockStream = 'invalid-file-stream'
        mockFs.createReadStream.mockReturnValue(mockStream as any)
        
        const formatError = new Error('Invalid keystore format')
        mockAppcircleApi.post.mockRejectedValue(formatError)

        await expect(uploadAndroidKeystoreFile({
          path: '/invalid.txt',
          name: 'test',
          password: 'pass',
          aliasPassword: 'alias'
        })).rejects.toThrow('Invalid keystore format')
      })
    })

    describe('generateNewKeystore', () => {
      it('should generate keystore with all parameters', async () => {
        const mockResponse = { id: 'ks123', name: 'generated-keystore' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await generateNewKeystore({
          name: 'test-keystore',
          password: 'pass123',
          passwordConfirm: 'pass123',
          validity: '365',
          alias: 'test-alias',
          aliasPassword: 'alias123',
          aliasPasswordConfirm: 'alias123'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'signing-identity/v2/keystores',
          expect.objectContaining({
            name: 'test-keystore',
            password: 'pass123',
            passwordConfirm: 'pass123',
            validity: '365',
            alias: 'test-alias',
            aliasPassword: 'alias123',
            aliasPasswordConfirm: 'alias123'
          }),
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle password mismatch error', async () => {
        const mismatchError = new Error('Passwords do not match')
        mockAppcircleApi.post.mockRejectedValue(mismatchError)

        await expect(generateNewKeystore({
          name: 'test',
          password: 'pass1',
          passwordConfirm: 'pass2',
          validity: '365',
          alias: 'alias',
          aliasPassword: 'alias1',
          aliasPasswordConfirm: 'alias1'
        })).rejects.toThrow('Passwords do not match')
      })

      it('should handle invalid validity period', async () => {
        const validityError = new Error('Invalid validity period')
        mockAppcircleApi.post.mockRejectedValue(validityError)

        await expect(generateNewKeystore({
          name: 'test',
          password: 'pass',
          passwordConfirm: 'pass',
          validity: 'invalid',
          alias: 'alias',
          aliasPassword: 'alias',
          aliasPasswordConfirm: 'alias'
        })).rejects.toThrow('Invalid validity period')
      })
    })

    describe('getKeystoreDetailById', () => {
      it('should fetch keystore details by ID', async () => {
        const mockKeystore = {
          id: 'ks123',
          name: 'Test Keystore',
          createdAt: '2024-01-01T10:00:00Z'
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockKeystore })

        const result = await getKeystoreDetailById({ keystoreId: 'ks123' })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'signing-identity/v2/keystores/ks123',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockKeystore)
      })

      it('should handle keystore not found', async () => {
        const notFoundError = new Error('Keystore not found')
        mockAppcircleApi.get.mockRejectedValue(notFoundError)

        await expect(getKeystoreDetailById({ 
          keystoreId: 'non-existent' 
        })).rejects.toThrow('Keystore not found')
      })
    })

    describe('removeKeystore', () => {
      it('should remove keystore successfully', async () => {
        const mockResponse = { success: true }
        mockAppcircleApi.delete.mockResolvedValue({ data: mockResponse })

        const result = await removeKeystore({ keystoreId: 'ks123' })

        expect(mockAppcircleApi.delete).toHaveBeenCalledWith(
          'signing-identity/v2/keystores/ks123',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle deletion failure', async () => {
        const deletionError = new Error('Cannot delete keystore in use')
        mockAppcircleApi.delete.mockRejectedValue(deletionError)

        await expect(removeKeystore({ 
          keystoreId: 'ks123' 
        })).rejects.toThrow('Cannot delete keystore in use')
      })
    })
  })

  describe('File Download Operations', () => {
    describe('downloadKeystoreById', () => {
      it('should download and save keystore file successfully', async () => {
        const mockStream = {
          pipe: vi.fn()
        }
        const mockWriter = {
          on: vi.fn(),
          close: vi.fn()
        }

        mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        // Simulate successful download
        mockWriter.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(), 0)
          }
          return mockWriter
        })

        const promise = downloadKeystoreById(
          { keystoreId: 'ks123', path: '/download' },
          '/download',
          'keystore.jks'
        )

        await expect(promise).resolves.toBe(true)
        
        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'signing-identity/v2/keystores/ks123',
          expect.objectContaining({
            responseType: 'stream',
            headers: expect.objectContaining({
              'content-type': expect.stringContaining('multipart/form-data')
            })
          })
        )
        expect(mockFs.createWriteStream).toHaveBeenCalledWith('/download/keystore.jks')
        expect(mockStream.pipe).toHaveBeenCalledWith(mockWriter)
      })

      it('should include multipart headers on keystore download GET request', async () => {
        const mockStream = { pipe: vi.fn() }
        const mockWriter = {
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'close') setTimeout(() => callback(), 0)
            return mockWriter
          }),
          close: vi.fn()
        }

        MockFormData.prototype.getHeaders = vi.fn().mockReturnValue({
          'content-type': 'multipart/form-data; boundary=keystore-test'
        })
        
        mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        await downloadKeystoreById(
          { keystoreId: 'ks123', path: '/download' },
          '/download',
          'keystore.jks'
        )

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'signing-identity/v2/keystores/ks123',
          expect.objectContaining({
            headers: expect.objectContaining({
              'content-type': 'multipart/form-data; boundary=keystore-test'
            })
          })
        )
      })

      it('should handle download stream errors', async () => {
        const mockStream = { pipe: vi.fn() }
        const mockWriter = {
          on: vi.fn(),
          close: vi.fn()
        }

        mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        // Simulate error during download
        const writeError = new Error('Write failed')
        mockWriter.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'error') {
            setTimeout(() => callback(writeError), 0)
          }
          return mockWriter
        })

        const promise = downloadKeystoreById(
          { keystoreId: 'ks123', path: '/download' },
          '/download',
          'keystore.jks'
        )

        await expect(promise).rejects.toThrow('Write failed')
      })

      it('should handle invalid download path', async () => {
        const pathError = new Error('EACCES: permission denied')
        mockFs.createWriteStream.mockImplementation(() => { 
          throw pathError 
        })

        await expect(downloadKeystoreById(
          { keystoreId: 'ks123', path: '/invalid' },
          '/invalid',
          'keystore.jks'
        )).rejects.toThrow('EACCES')
      })

      it('should handle API errors during download request', async () => {
        const apiError = new Error('Keystore not found')
        mockAppcircleApi.get.mockRejectedValue(apiError)

        await expect(downloadKeystoreById(
          { keystoreId: 'non-existent', path: '/download' },
          '/download',
          'keystore.jks'
        )).rejects.toThrow('Keystore not found')
      })
    })

    describe('downloadCertificateById', () => {
      it('should use correct endpoint for P12 extension', async () => {
        const mockStream = { pipe: vi.fn() }
        const mockWriter = {
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'close') setTimeout(() => callback(), 0)
            return mockWriter
          }),
          close: vi.fn()
        }

        mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        await downloadCertificateById(
          { certificateId: 'cert123', path: '/download' },
          '/download',
          'cert.p12',
          'p12'
        )

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'signing-identity/v2/certificates/cert123',
          expect.objectContaining({ 
            responseType: 'stream',
            headers: expect.objectContaining({
              'content-type': expect.stringContaining('multipart/form-data')
            })
          })
        )
      })

      it('should include multipart headers on certificate download GET request', async () => {
        const mockStream = { pipe: vi.fn() }
        const mockWriter = {
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'close') setTimeout(() => callback(), 0)
            return mockWriter
          }),
          close: vi.fn()
        }

        MockFormData.prototype.getHeaders = vi.fn().mockReturnValue({
          'content-type': 'multipart/form-data; boundary=cert-test'
        })
        
        mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        await downloadCertificateById(
          { certificateId: 'cert123', path: '/download' },
          '/download',
          'cert.csr',
          'csr'
        )

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'signing-identity/v1/csr/cert123',
          expect.objectContaining({
            headers: expect.objectContaining({
              'content-type': 'multipart/form-data; boundary=cert-test'
            })
          })
        )
      })

      it('should use correct endpoint for CSR extension', async () => {
        const mockStream = { pipe: vi.fn() }
        const mockWriter = {
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'close') setTimeout(() => callback(), 0)
            return mockWriter
          }),
          close: vi.fn()
        }

        mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        await downloadCertificateById(
          { certificateId: 'cert123', path: '/download' },
          '/download',
          'cert.csr',
          'csr'
        )

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'signing-identity/v1/csr/cert123',
          expect.objectContaining({ responseType: 'stream' })
        )
      })

      it('should handle download cancellation', async () => {
        const mockStream = { pipe: vi.fn() }
        const mockWriter = {
          on: vi.fn(),
          close: vi.fn()
        }

        mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        const cancelError = new Error('Download cancelled')
        mockWriter.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'error') {
            setTimeout(() => callback(cancelError), 0)
          }
          return mockWriter
        })

        await expect(downloadCertificateById(
          { certificateId: 'cert123', path: '/download' },
          '/download',
          'cert.p12',
          'p12'
        )).rejects.toThrow('Download cancelled')
      })
    })
  })

  describe('iOS CSR Certificates', () => {
    describe('getiOSCSRCertificates', () => {
      it('should fetch and transform CSR certificates', async () => {
        const mockCSRs = [
          { id: 'csr1', name: 'CSR 1' },
          { id: 'csr2', name: 'CSR 2' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockCSRs })

        const result = await getiOSCSRCertificates()

        expect(result).toHaveLength(2)
        result.forEach((csr: any) => {
          expect(csr).toHaveProperty('extension', 'CSR')
          expect(csr).toHaveProperty('storeType', 1)
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'signing-identity/v1/csr',
          { headers: expect.any(Object) }
        )
      })

      it('should handle empty CSR list', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })
        
        const result = await getiOSCSRCertificates()
        
        expect(result).toEqual([])
      })
    })

    describe('createCSRCertificateRequest', () => {
      it('should create CSR with storeType property', async () => {
        const mockResponse = { id: 'csr123', name: 'Test CSR' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await createCSRCertificateRequest({
          name: 'Test Certificate',
          email: 'test@example.com',
          countryCode: 'US'
        })

        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'signing-identity/v1/csr',
          expect.objectContaining({
            name: 'Test Certificate',
            email: 'test@example.com',
            countryCode: 'US'
          }),
          { headers: expect.any(Object) }
        )

        expect(result).toHaveProperty('storeType', 1)
        expect(result).toMatchObject(mockResponse)
      })

      it('should handle CSR creation failure', async () => {
        const creationError = new Error('CSR creation failed')
        mockAppcircleApi.post.mockRejectedValue(creationError)

        await expect(createCSRCertificateRequest({
          name: 'Test',
          email: 'test@example.com',
          countryCode: 'US'
        })).rejects.toThrow('CSR creation failed')
      })
    })

    describe('removeCSRorP12CertificateById', () => {
      it('should use correct endpoint for P12 removal', async () => {
        const mockResponse = { success: true }
        mockAppcircleApi.delete.mockResolvedValue({ data: mockResponse })

        const result = await removeCSRorP12CertificateById(
          { certificateId: 'cert123', path: '/path' },
          'p12'
        )

        expect(mockAppcircleApi.delete).toHaveBeenCalledWith(
          'signing-identity/v2/certificates/cert123',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })

      it('should use correct endpoint for CSR removal', async () => {
        const mockResponse = { success: true }
        mockAppcircleApi.delete.mockResolvedValue({ data: mockResponse })

        const result = await removeCSRorP12CertificateById(
          { certificateId: 'csr123', path: '/path' },
          'csr'
        )

        expect(mockAppcircleApi.delete).toHaveBeenCalledWith(
          'signing-identity/v1/csr/csr123',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })
    })
  })

  describe('Provisioning Profiles', () => {
    describe('getProvisioningProfiles', () => {
      it('should fetch provisioning profiles successfully', async () => {
        const mockProfiles = [
          { id: 'pp1', name: 'Development Profile' },
          { id: 'pp2', name: 'Distribution Profile' }
        ]
        mockAppcircleApi.get.mockResolvedValue({ data: mockProfiles })

        const result = await getProvisioningProfiles()

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'signing-identity/v2/provisioning-profiles',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockProfiles)
      })

      it('should handle empty profiles list', async () => {
        mockAppcircleApi.get.mockResolvedValue({ data: [] })
        
        const result = await getProvisioningProfiles()
        
        expect(result).toEqual([])
      })
    })

    describe('uploadProvisioningProfile', () => {
      it('should upload provisioning profile successfully', async () => {
        const mockStream = 'mock-profile-stream'
        mockFs.createReadStream.mockReturnValue(mockStream as any)
        
        const mockResponse = { id: 'pp123', name: 'uploaded-profile' }
        mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

        const result = await uploadProvisioningProfile({ 
          path: '/profile.mobileprovision' 
        })

        expect(MockFormData.prototype.append).toHaveBeenCalledWith('Binary', mockStream)
        expect(mockAppcircleApi.post).toHaveBeenCalledWith(
          'signing-identity/v2/provisioning-profiles',
          expect.any(FormData),
          expect.objectContaining({ maxBodyLength: Infinity })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle invalid provisioning profile format', async () => {
        const mockStream = 'invalid-stream'
        mockFs.createReadStream.mockReturnValue(mockStream as any)
        
        const formatError = new Error('Invalid provisioning profile format')
        mockAppcircleApi.post.mockRejectedValue(formatError)

        await expect(uploadProvisioningProfile({ 
          path: '/invalid.txt' 
        })).rejects.toThrow('Invalid provisioning profile format')
      })
    })

    describe('getProvisioningProfileDetailById', () => {
      it('should fetch profile details by ID', async () => {
        const mockProfile = {
          id: 'pp123',
          name: 'Test Profile',
          expirationDate: '2024-12-31'
        }
        mockAppcircleApi.get.mockResolvedValue({ data: mockProfile })

        const result = await getProvisioningProfileDetailById({ 
          provisioningProfileId: 'pp123' 
        })

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'signing-identity/v2/provisioning-profiles/pp123',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockProfile)
      })
    })

    describe('removeProvisioningProfile', () => {
      it('should remove provisioning profile successfully', async () => {
        const mockResponse = { success: true }
        mockAppcircleApi.delete.mockResolvedValue({ data: mockResponse })

        const result = await removeProvisioningProfile({ 
          provisioningProfileId: 'pp123' 
        })

        expect(mockAppcircleApi.delete).toHaveBeenCalledWith(
          'signing-identity/v1/provisioning-profiles/pp123',
          { headers: expect.any(Object) }
        )
        expect(result).toEqual(mockResponse)
      })
    })

    describe('downloadProvisioningProfileById', () => {
      it('should download provisioning profile successfully', async () => {
        const mockStream = { pipe: vi.fn() }
        const mockWriter = {
          on: vi.fn().mockImplementation((event: string, callback: Function) => {
            if (event === 'close') setTimeout(() => callback(), 0)
            return mockWriter
          }),
          close: vi.fn()
        }

        mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        await downloadProvisioningProfileById(
          { provisioningProfileId: 'pp123' },
          '/download',
          'profile.mobileprovision'
        )

        expect(mockAppcircleApi.get).toHaveBeenCalledWith(
          'signing-identity/v2/provisioning-profiles/pp123',
          expect.objectContaining({ responseType: 'stream' })
        )
        expect(mockFs.createWriteStream).toHaveBeenCalledWith('/download/profile.mobileprovision')
      })

      it('should handle provisioning profile download writer error', async () => {
        const mockStream = { pipe: vi.fn() }
        const mockWriter = {
          on: vi.fn(),
          close: vi.fn()
        }

        mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
        mockFs.createWriteStream.mockReturnValue(mockWriter as any)

        const writeError = new Error('Write failed')
        mockWriter.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'error') {
            setTimeout(() => callback(writeError), 0)
          }
          return mockWriter
        })

        await expect(downloadProvisioningProfileById(
          { provisioningProfileId: 'pp123' },
          '/download',
          'profile.mobileprovision'
        )).rejects.toThrow('Write failed')
      })

      it('should handle provisioning profile API errors', async () => {
        const apiError = new Error('Provisioning profile not found')
        mockAppcircleApi.get.mockRejectedValue(apiError)

        await expect(downloadProvisioningProfileById(
          { provisioningProfileId: 'non-existent' },
          '/download',
          'profile.mobileprovision'
        )).rejects.toThrow('Provisioning profile not found')
      })

      it('should handle invalid download path for provisioning profile', async () => {
        const pathError = new Error('EACCES: permission denied')
        
        // Mock API call to succeed first, then fs should fail
        const mockStream = { pipe: vi.fn() }
        mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
        
        // Mock fs.createWriteStream to throw error
        mockFs.createWriteStream.mockImplementationOnce(() => { 
          throw pathError 
        })

        await expect(downloadProvisioningProfileById(
          { provisioningProfileId: 'pp123' },
          '/invalid-path',
          'profile.mobileprovision'
        )).rejects.toThrow('EACCES')
      })
    })
  })

  describe('API Version Consistency', () => {
    it('should use v2 endpoints for certificate operations', async () => {
      mockAppcircleApi.get.mockResolvedValue({ data: [] })
      mockAppcircleApi.post.mockResolvedValue({ data: {} })

      await getiOSP12Certificates()
      await uploadP12Certificate({ path: '/cert.p12', password: 'pass' })
      
      expect(mockAppcircleApi.get).toHaveBeenCalledWith(
        'signing-identity/v2/certificates', 
        expect.any(Object)
      )
      expect(mockAppcircleApi.post).toHaveBeenCalledWith(
        'signing-identity/v2/certificates', 
        expect.any(FormData), 
        expect.any(Object)
      )
    })

    it('should use v1 endpoints for CSR operations', async () => {
      mockAppcircleApi.get.mockResolvedValue({ data: [] })
      mockAppcircleApi.post.mockResolvedValue({ data: {} })

      await getiOSCSRCertificates()
      await createCSRCertificateRequest({ 
        name: 'test', 
        email: 'test@example.com', 
        countryCode: 'US' 
      })
      
      expect(mockAppcircleApi.get).toHaveBeenCalledWith(
        'signing-identity/v1/csr', 
        expect.any(Object)
      )
      expect(mockAppcircleApi.post).toHaveBeenCalledWith(
        'signing-identity/v1/csr', 
        expect.any(Object), 
        expect.any(Object)
      )
    })

    it('should handle version inconsistencies in provisioning profiles', async () => {
      mockAppcircleApi.get.mockResolvedValue({ data: [] })
      mockAppcircleApi.delete.mockResolvedValue({ data: {} })

      await getProvisioningProfiles() // uses v2
      await removeProvisioningProfile({ provisioningProfileId: 'pp123' }) // uses v1
      
      // Get operation uses v2
      expect(mockAppcircleApi.get).toHaveBeenCalledWith(
        'signing-identity/v2/provisioning-profiles',
        expect.any(Object)
      )
      
      // Delete operation uses v1 (inconsistency)
      expect(mockAppcircleApi.delete).toHaveBeenCalledWith(
        'signing-identity/v1/provisioning-profiles/pp123',
        expect.any(Object)
      )
    })

    it('should use v2 for keystore operations consistently', async () => {
      mockAppcircleApi.get.mockResolvedValue({ data: [] })
      mockAppcircleApi.post.mockResolvedValue({ data: {} })
      mockAppcircleApi.delete.mockResolvedValue({ data: {} })

      await getAndroidKeystores()
      await generateNewKeystore({
        name: 'test', password: 'pass', passwordConfirm: 'pass',
        validity: '365', alias: 'alias', aliasPassword: 'alias', 
        aliasPasswordConfirm: 'alias'
      })
      await removeKeystore({ keystoreId: 'ks123' })

      // All should use v2
      expect(mockAppcircleApi.get).toHaveBeenCalledWith(
        'signing-identity/v2/keystores', 
        expect.any(Object)
      )
      expect(mockAppcircleApi.post).toHaveBeenCalledWith(
        'signing-identity/v2/keystores', 
        expect.any(Object),
        expect.any(Object)
      )
      expect(mockAppcircleApi.delete).toHaveBeenCalledWith(
        'signing-identity/v2/keystores/ks123', 
        expect.any(Object)
      )
    })
  })

  describe('Comprehensive Error Handling', () => {
    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('timeout of 5000ms exceeded')
      timeoutError.name = 'AxiosError'
      ;(timeoutError as any).code = 'ECONNABORTED'
      
      mockAppcircleApi.get.mockRejectedValue(timeoutError)

      await expect(getiOSP12Certificates()).rejects.toThrow(/timeout/)
    })

    it('should handle 413 Payload Too Large errors', async () => {
      const payloadError = new Error('Request entity too large')
      payloadError.name = 'AxiosError'
      ;(payloadError as any).response = { status: 413 }

      const mockStream = 'large-file-stream'
      mockFs.createReadStream.mockReturnValue(mockStream as any)
      mockAppcircleApi.post.mockRejectedValue(payloadError)

      await expect(uploadP12Certificate({
        path: '/huge-cert.p12',
        password: 'pass'
      })).rejects.toThrow(/too large/)
    })

    it('should handle disk space errors during download', async () => {
      const diskError = new Error('ENOSPC: no space left on device')
      const mockStream = { pipe: vi.fn() }
      const mockWriter = {
        on: vi.fn().mockImplementation((event: string, callback: Function) => {
          if (event === 'error') callback(diskError)
          return mockWriter
        }),
        close: vi.fn()
      }

      mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
      mockFs.createWriteStream.mockReturnValue(mockWriter as any)

      await expect(downloadKeystoreById(
        { keystoreId: 'ks123', path: '/full-disk' },
        '/full-disk',
        'keystore.jks'
      )).rejects.toThrow('ENOSPC')
    })

    it('should handle authentication errors', async () => {
      const authError = new Error('Unauthorized')
      ;(authError as any).response = { status: 401 }
      
      mockAppcircleApi.get.mockRejectedValue(authError)

      await expect(getAndroidKeystores()).rejects.toThrow('Unauthorized')
    })

    it('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Too Many Requests')
      ;(rateLimitError as any).response = { 
        status: 429,
        headers: { 'retry-after': '60' }
      }
      
      mockAppcircleApi.post.mockRejectedValue(rateLimitError)

      await expect(uploadP12Certificate({ 
        path: '/cert.p12', 
        password: 'pass' 
      })).rejects.toThrow('Too Many Requests')
    })

    it('should handle file system errors', async () => {
      const fsError = new Error('EACCES: permission denied, open \'/protected/file\'')
      mockFs.createReadStream.mockImplementation(() => { throw fsError })

      await expect(uploadAndroidKeystoreFile({
        path: '/protected/keystore.jks',
        name: 'test',
        password: 'pass',
        aliasPassword: 'alias'
      })).rejects.toThrow('EACCES')
    })
  })

  describe('Source Code Issues and Improvements', () => {
    it('should highlight the typo in provisioning profile field name', async () => {
      // This test serves as documentation for the typo in the source code
      // downloadProvisioningProfileById uses "Profisioning Profile Id" instead of "Provisioning Profile Id"
      const appendSpy = vi.spyOn(FormData.prototype, 'append')
      const mockStream = { pipe: vi.fn() }
      const mockWriter = {
        on: vi.fn().mockImplementation((event: string, callback: Function) => {
          if (event === 'close') setTimeout(() => callback(), 0)
          return mockWriter
        }),
        close: vi.fn()
      }

      mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
      mockFs.createWriteStream.mockReturnValue(mockWriter as any)

      await downloadProvisioningProfileById(
        { provisioningProfileId: 'pp123' },
        '/download',
        'profile.mobileprovision'
      )

      // This assertion captures the current typo in the source code
      expect(appendSpy).toHaveBeenCalledWith('Profisioning Profile Id', 'pp123')
      
      // TODO: Fix typo in source code to "Provisioning Profile Id"
      // and update this test expectation accordingly
    })
  })

  describe('Data Transformation', () => {
    it('should add extension property to P12 certificates', async () => {
      const mockCerts = [{ id: 'cert1' }, { id: 'cert2' }]
      mockAppcircleApi.get.mockResolvedValue({ data: mockCerts })

      const result = await getiOSP12Certificates()

      result.forEach((cert: any) => {
        expect(cert).toHaveProperty('extension', 'P12')
        expect(cert).toHaveProperty('id')
      })
    })

    it('should add extension and storeType to CSR certificates', async () => {
      const mockCSRs = [{ id: 'csr1' }, { id: 'csr2' }]
      mockAppcircleApi.get.mockResolvedValue({ data: mockCSRs })

      const result = await getiOSCSRCertificates()

      result.forEach((csr: any) => {
        expect(csr).toHaveProperty('extension', 'CSR')
        expect(csr).toHaveProperty('storeType', 1)
        expect(csr).toHaveProperty('id')
      })
    })

    it('should add storeType to CSR creation response', async () => {
      const mockResponse = { id: 'csr123', name: 'Test CSR' }
      mockAppcircleApi.post.mockResolvedValue({ data: mockResponse })

      const result = await createCSRCertificateRequest({
        name: 'Test Certificate',
        email: 'test@example.com',
        countryCode: 'US'
      })

      expect(result).toHaveProperty('storeType', 1)
      expect(result).toMatchObject(mockResponse)
      expect(result.id).toBe('csr123')
      expect(result.name).toBe('Test CSR')
    })

    it('should preserve original data while adding transformation properties', async () => {
      const mockCert = { 
        id: 'cert1', 
        name: 'Original Name',
        validFrom: '2024-01-01',
        validUntil: '2025-01-01'
      }
      mockAppcircleApi.get.mockResolvedValue({ data: [mockCert] })

      const result = await getiOSP12Certificates()

      expect(result[0]).toEqual({
        ...mockCert,
        extension: 'P12'
      })
    })

    it('should handle null/undefined data in transformation consistently', async () => {
      mockAppcircleApi.get.mockResolvedValue({ data: null })

      const result = await getiOSP12Certificates()

      // NOTE: Current implementation returns undefined for null data
      // This behavior is documented and intentional for P12 certificates
      // Consider returning [] for consistency with other functions
      expect(result).toBeUndefined()
    })

    it('should document P12 vs CSR transformation behavior difference', async () => {
      // P12 certificates return undefined for null data
      mockAppcircleApi.get.mockResolvedValue({ data: null })
      const p12Result = await getiOSP12Certificates()
      expect(p12Result).toBeUndefined()

      // CSR certificates also return undefined for null data
      const csrResult = await getiOSCSRCertificates()
      expect(csrResult).toBeUndefined()

      // Both behaviors are consistent but different from other services
      // that might return empty arrays for null data
    })

    it('should handle empty array in transformation', async () => {
      mockAppcircleApi.get.mockResolvedValue({ data: [] })

      const result = await getiOSCSRCertificates()

      expect(result).toEqual([])
    })
  })

  describe('FormData Field Names and Download Parameters', () => {
    it('should append correct FormData fields for keystore download', async () => {
      const appendSpy = vi.spyOn(FormData.prototype, 'append')
      const mockStream = { pipe: vi.fn() }
      const mockWriter = {
        on: vi.fn().mockImplementation((event: string, callback: Function) => {
          if (event === 'close') setTimeout(() => callback(), 0)
          return mockWriter
        }),
        close: vi.fn()
      }

      mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
      mockFs.createWriteStream.mockReturnValue(mockWriter as any)

      await downloadKeystoreById(
        { keystoreId: 'ks123', path: '/download' },
        '/download',
        'keystore.jks'
      )

      expect(appendSpy).toHaveBeenCalledWith('Path', '/download')
      expect(appendSpy).toHaveBeenCalledWith('Keystore Id', 'ks123')
    })

    it('should append correct FormData fields for certificate download', async () => {
      const appendSpy = vi.spyOn(FormData.prototype, 'append')
      const mockStream = { pipe: vi.fn() }
      const mockWriter = {
        on: vi.fn().mockImplementation((event: string, callback: Function) => {
          if (event === 'close') setTimeout(() => callback(), 0)
          return mockWriter
        }),
        close: vi.fn()
      }

      mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
      mockFs.createWriteStream.mockReturnValue(mockWriter as any)

      await downloadCertificateById(
        { certificateId: 'cert123', path: '/download' },
        '/download',
        'cert.p12',
        'p12'
      )

      expect(appendSpy).toHaveBeenCalledWith('Path', '/download')
      expect(appendSpy).toHaveBeenCalledWith('Certificate Id', 'cert123')
    })

    it('should detect typo in provisioning profile FormData field name', async () => {
      const appendSpy = vi.spyOn(FormData.prototype, 'append')
      const mockStream = { pipe: vi.fn() }
      const mockWriter = {
        on: vi.fn().mockImplementation((event: string, callback: Function) => {
          if (event === 'close') setTimeout(() => callback(), 0)
          return mockWriter
        }),
        close: vi.fn()
      }

      mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
      mockFs.createWriteStream.mockReturnValue(mockWriter as any)

      await downloadProvisioningProfileById(
        { provisioningProfileId: 'pp123' },
        '/download',
        'profile.mobileprovision'
      )

      expect(appendSpy).toHaveBeenCalledWith('Path', '/download')
      // NOTE: This test captures the typo "Profisioning" in the source code
      expect(appendSpy).toHaveBeenCalledWith('Profisioning Profile Id', 'pp123')
    })
  })

  describe('Empty Parameter Validation', () => {
    it('should handle empty keystoreId gracefully', async () => {
      const mockKeystore = { id: '', name: 'Empty ID Keystore' }
      mockAppcircleApi.get.mockResolvedValue({ data: mockKeystore })

      const result = await getKeystoreDetailById({ keystoreId: '' })

      expect(mockAppcircleApi.get).toHaveBeenCalledWith(
        'signing-identity/v2/keystores/',
        { headers: expect.any(Object) }
      )
      expect(result).toEqual(mockKeystore)
    })

    it('should handle empty certificateBundleId gracefully', async () => {
      const mockCertificate = { id: '', name: 'Empty ID Certificate' }
      mockAppcircleApi.get.mockResolvedValue({ data: mockCertificate })

      const result = await getCertificateDetailById({ certificateBundleId: '' })

      expect(mockAppcircleApi.get).toHaveBeenCalledWith(
        'signing-identity/v2/certificates/',
        { headers: expect.any(Object) }
      )
      expect(result).toEqual(mockCertificate)
    })

    it('should handle empty provisioningProfileId gracefully', async () => {
      const mockProfile = { id: '', name: 'Empty ID Profile' }
      mockAppcircleApi.get.mockResolvedValue({ data: mockProfile })

      const result = await getProvisioningProfileDetailById({ provisioningProfileId: '' })

      expect(mockAppcircleApi.get).toHaveBeenCalledWith(
        'signing-identity/v2/provisioning-profiles/',
        { headers: expect.any(Object) }
      )
      expect(result).toEqual(mockProfile)
    })

    it('should handle undefined keystoreId in URL construction', async () => {
      const mockKeystore = { id: 'found', name: 'Test Keystore' }
      mockAppcircleApi.get.mockResolvedValue({ data: mockKeystore })

      const result = await getKeystoreDetailById({ keystoreId: undefined as any })

      expect(mockAppcircleApi.get).toHaveBeenCalledWith(
        'signing-identity/v2/keystores/undefined',
        { headers: expect.any(Object) }
      )
      expect(result).toEqual(mockKeystore)
    })
  })

  describe('Input Validation and Edge Cases', () => {
    it('should handle special characters in file paths', async () => {
      const specialPaths = [
        '/path with spaces/cert.p12',
        '/path/cert (v1.0).p12',
        '/path/cert-file_name.p12'
      ]

      const mockStream = 'mock-stream'
      mockFs.createReadStream.mockReturnValue(mockStream as any)
      mockAppcircleApi.post.mockResolvedValue({ data: {} })

      for (const path of specialPaths) {
        await uploadP12Certificate({ path, password: 'test' })
        expect(mockFs.createReadStream).toHaveBeenCalledWith(path)
      }
    })

    it('should handle unicode characters in parameters', async () => {
      mockAppcircleApi.post.mockResolvedValue({ data: { id: 'csr123' } })

      const result = await createCSRCertificateRequest({
        name: 'Тест Certificate 测试',
        email: 'тест@example.com',
        countryCode: 'US'
      })

      expect(mockAppcircleApi.post).toHaveBeenCalledWith(
        'signing-identity/v1/csr',
        expect.objectContaining({
          name: 'Тест Certificate 测试',
          email: 'тест@example.com'
        }),
        expect.any(Object)
      )
      expect(result).toHaveProperty('storeType', 1)
    })

    it('should handle empty string parameters', async () => {
      const mockStream = 'mock-stream'
      mockFs.createReadStream.mockReturnValue(mockStream as any)
      mockAppcircleApi.post.mockResolvedValue({ data: {} })

      await uploadP12Certificate({ path: '/cert.p12', password: '' })

      expect(MockFormData.prototype.append).toHaveBeenCalledWith('password', '')
    })

    it('should handle very long file names', async () => {
      const longFileName = 'a'.repeat(200) + '.p12'
      const mockStream = { pipe: vi.fn() }
      const mockWriter = {
        on: vi.fn().mockImplementation((event: string, callback: Function) => {
          if (event === 'close') setTimeout(() => callback(), 0)
          return mockWriter
        }),
        close: vi.fn()
      }

      mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
      mockFs.createWriteStream.mockReturnValue(mockWriter as any)

      await downloadKeystoreById(
        { keystoreId: 'ks123', path: '/download' },
        '/download',
        longFileName
      )

      expect(mockFs.createWriteStream).toHaveBeenCalledWith(`/download/${longFileName}`)
    })

    it('should handle concurrent operations', async () => {
      const mockCerts = [{ id: 'cert1' }, { id: 'cert2' }]
      mockAppcircleApi.get.mockResolvedValue({ data: mockCerts })

      const promises = Array(5).fill(null).map(() => getiOSP12Certificates())
      const results = await Promise.all(promises)

      expect(results).toHaveLength(5)
      results.forEach((result: any) => {
        expect(result).toHaveLength(2)
        result.forEach((cert: any) => expect(cert).toHaveProperty('extension', 'P12'))
      })
      expect(mockAppcircleApi.get).toHaveBeenCalledTimes(5)
    })
  })

  describe('Headers and Authentication', () => {
    it('should include proper headers in non-multipart requests', async () => {
      vi.clearAllMocks()
      mockAppcircleApi.get.mockResolvedValue({ data: [] })
      mockAppcircleApi.post.mockResolvedValue({ data: {} })
      mockAppcircleApi.delete.mockResolvedValue({ data: {} })

      // Non-multipart requests only
      await getiOSP12Certificates()
      await createCSRCertificateRequest({ name: 'test', email: 'test@example.com', countryCode: 'US' })
      await removeKeystore({ keystoreId: 'ks123' })

      const allCalls = [
        ...mockAppcircleApi.get.mock.calls,
        ...mockAppcircleApi.post.mock.calls,
        ...mockAppcircleApi.delete.mock.calls
      ]

      allCalls.forEach((call: any) => {
        const config = call[call.length - 1] // Last parameter is config
        expect(config).toBeDefined()
        expect(config.headers).toEqual(expect.objectContaining({
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        }))
      })
    })

    it('should include authorization headers in multipart upload requests', async () => {
      const mockStream = 'mock-stream'
      mockFs.createReadStream.mockReturnValue(mockStream as any)
      mockAppcircleApi.post.mockResolvedValue({ data: {} })

      await uploadP12Certificate({ path: '/cert.p12', password: 'pass' })
      await uploadAndroidKeystoreFile({
        path: '/keystore.jks',
        name: 'test',
        password: 'pass',
        aliasPassword: 'alias'
      })

      const multipartCalls = mockAppcircleApi.post.mock.calls.filter(call => 
        call[1] instanceof FormData
      )

      multipartCalls.forEach((call: any) => {
        const config = call[call.length - 1] // Last parameter is config
        expect(config.headers).toEqual(expect.objectContaining({
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
          'content-type': expect.stringContaining('multipart/form-data')
        }))
      })
    })

    it('should call getHeaders for all API requests', async () => {
      mockAppcircleApi.get.mockResolvedValue({ data: [] })

      await getAndroidKeystores()

      expect(mockGetHeaders).toHaveBeenCalled()
    })

    it('should merge FormData headers correctly for uploads', async () => {
      const mockStream = 'mock-stream'
      mockFs.createReadStream.mockReturnValue(mockStream as any)
      mockAppcircleApi.post.mockResolvedValue({ data: {} })

      await uploadP12Certificate({ path: '/cert.p12', password: 'pass' })

      expect(mockAppcircleApi.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
            'content-type': 'multipart/form-data; boundary=test'
          })
        })
      )
    })

    it('should merge FormData headers correctly for download requests', async () => {
      const mockStream = { pipe: vi.fn() }
      const mockWriter = {
        on: vi.fn().mockImplementation((event: string, callback: Function) => {
          if (event === 'close') setTimeout(() => callback(), 0)
          return mockWriter
        }),
        close: vi.fn()
      }

      MockFormData.prototype.getHeaders = vi.fn().mockReturnValue({
        'content-type': 'multipart/form-data; boundary=download-test'
      })
      
      mockAppcircleApi.get.mockResolvedValue({ data: mockStream })
      mockFs.createWriteStream.mockReturnValue(mockWriter as any)

      await downloadProvisioningProfileById(
        { provisioningProfileId: 'pp123' },
        '/download',
        'profile.mobileprovision'
      )

      expect(mockAppcircleApi.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
            'content-type': 'multipart/form-data; boundary=download-test'
          })
        })
      )
    })
  })
})