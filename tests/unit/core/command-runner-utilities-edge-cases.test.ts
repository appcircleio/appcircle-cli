import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createRequire } from 'module'
import {
  expandTildeInPath,
  validateFileExists,
  ensureDirectoryExists,
  resolveOrganizationIdFromParams,
  resolveBranchIdFromName,
  resolveWorkflowIdFromName,
  resolveConfigurationIdFromName,
  setupDownloadDirectory,
  checkIfUserAlreadyLoggedIn,
  checkIfUserIsLoggedIn,
  selectBuildMonitorMode,
  selectBuildExecutionMode,
  BuildMonitorMode,
  BuildExecutionMode
} from '../../../src/core/command-runner-utilities'

const mockFs = vi.mocked(fs)

describe('command-runner-utilities edge cases', () => {
  beforeEach(() => {
    vi.mocked(os.homedir).mockReturnValue('/home/tester')
    vi.mocked(path.resolve).mockImplementation((p: string) => p)
    vi.mocked(path.join).mockImplementation((...parts: string[]) => parts.join('/'))
  })

  describe('file system helpers', () => {
    it('expands a bare tilde to the home directory', () => {
      expect(expandTildeInPath('  ~  ')).toBe('/home/tester')
    })

    it('reports a file that cannot be inspected', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied')
      })

      expect(validateFileExists('/secret/file.ipa')).toEqual({
        isValid: false,
        error: 'Cannot access file: EACCES: permission denied',
        expandedPath: '/secret/file.ipa'
      })
    })

    it('rejects an existing path that is not a directory', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any)

      expect(ensureDirectoryExists('/data/file.txt')).toEqual({
        isValid: false,
        error: 'Path is not a directory: /data/file.txt'
      })
      expect(mockFs.mkdirSync).not.toHaveBeenCalled()
    })

    it('falls back to the home directory when the default download directory is unusable', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any)

      expect(setupDownloadDirectory()).toEqual({
        isValid: false,
        error: 'Path is not a directory: /home/tester/Downloads',
        downloadPath: '/home/tester'
      })
    })

    it('falls back to the home directory when both the given and the fallback directory are unusable', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any)

      expect(setupDownloadDirectory('/given/file', '/fallback/file')).toEqual({
        isValid: true,
        downloadPath: '/home/tester'
      })
    })
  })

  describe('name resolution', () => {
    const organizations = [
      { id: 'org-a', name: 'Alpha' },
      { id: 'org-b', name: 'Beta' }
    ]

    it('resolves an organization name when the organization ID is "current"', () => {
      expect(
        resolveOrganizationIdFromParams({ organization: 'Beta', organizationId: 'current' }, organizations)
      ).toEqual({ isValid: true, organizationId: 'org-b' })
    })

    it('keeps the given branch ID when no branch name is given', () => {
      expect(resolveBranchIdFromName({ branchId: 'br-1' }, [{ id: 'br-2', name: 'main' }])).toEqual({
        isValid: true,
        branchId: 'br-1'
      })
    })

    it('keeps the given workflow ID when no workflow name is given', () => {
      expect(resolveWorkflowIdFromName({ workflowId: 'wf-1' }, [{ id: 'wf-2', workflowName: 'Default' }])).toEqual({
        isValid: true,
        workflowId: 'wf-1'
      })
    })

    it('keeps the given configuration ID when no configuration name is given', () => {
      expect(
        resolveConfigurationIdFromName({ configurationId: 'cfg-1' }, [{ item1: { id: 'cfg-2', configurationName: 'Release' } }])
      ).toEqual({ isValid: true, configurationId: 'cfg-1' })
    })
  })

  // Known broken default: the require('../../config') fallback path is wrong. It is dead code today,
  // because every production caller injects the config service. If src fixes the path, update these tests.
  describe('default config service', () => {
    it('checkIfUserAlreadyLoggedIn fails because ../../config cannot be resolved from src/core', () => {
      expect(() => checkIfUserAlreadyLoggedIn()).toThrow("Cannot find module '../../config'")
    })

    it('checkIfUserIsLoggedIn fails because ../../config cannot be resolved from src/core', () => {
      expect(() => checkIfUserIsLoggedIn()).toThrow("Cannot find module '../../config'")
    })
  })

  describe('default enquirer prompts', () => {
    const AutoComplete = createRequire(import.meta.url)('enquirer/lib/prompts/autocomplete')
    let seenOptions: any[]
    let runSpy: ReturnType<typeof vi.spyOn> | undefined

    beforeEach(() => {
      seenOptions = []
    })

    afterEach(() => {
      runSpy?.mockRestore()
    })

    it('selectBuildMonitorMode asks with an AutoComplete prompt and maps the answer', async () => {
      runSpy = vi.spyOn(AutoComplete.prototype, 'run').mockImplementation(function (this: any) {
        seenOptions.push(this.options)
        return Promise.resolve('3. Steps - Wait until completion, show step-by-step progress (started/finished) minimally')
      })

      await expect(selectBuildMonitorMode()).resolves.toEqual({ mode: BuildMonitorMode.STEPS, cancelled: false })
      expect(seenOptions).toHaveLength(1)
      expect(seenOptions[0]).toMatchObject({
        name: 'monitorMode',
        message: 'Select build monitoring preference:',
        limit: 10
      })
      expect(seenOptions[0].choices).toHaveLength(4)
    })

    it('selectBuildExecutionMode asks with an AutoComplete prompt and maps the answer', async () => {
      runSpy = vi.spyOn(AutoComplete.prototype, 'run').mockImplementation(function (this: any) {
        seenOptions.push(this.options)
        return Promise.resolve('3. Full logs - Real-time verbose build output streaming')
      })

      await expect(selectBuildExecutionMode()).resolves.toEqual({
        mode: BuildExecutionMode.DETAILED_MONITORING,
        cancelled: false
      })
      expect(seenOptions[0]).toMatchObject({ name: 'executionMode', limit: 10 })
    })
  })
})
