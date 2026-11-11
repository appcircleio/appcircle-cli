import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  writeTestingDistributionCommand,
  writeTestingGroupList,
  writeTestingGroupView,
  writeBuildCommand,
  writeBuildWorkflowList,
  writeBuildConfigurationList,
  writeBuildVariableGroupList,
  writeBuildVariableView,
  writeEnterpriseAppStoreCommand,
  writePublishCommand,
  writePublishProfileVersionList,
  writePublishProfileVersionView,
  writePublishActiveList,
  writePublishView,
  writeSigningIdentityCommand,
  writeSigningCertificateList,
  writeSigningCertificateUpload,
  writeSigningCertificateCreate,
  writeSigningCertificateView,
  writeSigningKeystoreList,
  writeSigningKeystoreView,
  writeSigningProvisioningProfileList,
  writeSigningProvisioningProfileView
} from '../../../src/core/writer-commands'

let table: ReturnType<typeof vi.spyOn>
let log: ReturnType<typeof vi.spyOn>
let info: ReturnType<typeof vi.spyOn>

const printedTable = () => table.mock.calls[0]?.[0]

describe('writer-commands fallbacks', () => {
  beforeEach(() => {
    table = vi.spyOn(console, 'table').mockImplementation(() => {})
    log = vi.spyOn(console, 'log').mockImplementation(() => {})
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
    table.mockClear()
    log.mockClear()
    info.mockClear()
  })

  describe('command routing', () => {
    it('prints nothing for an unknown testing distribution, enterprise or signing command', () => {
      writeTestingDistributionCommand({ fullCommandName: 'appcircle-testing-distribution-unknown', data: [] })
      writeEnterpriseAppStoreCommand({ fullCommandName: 'appcircle-enterprise-app-store-unknown', data: [] })
      writeSigningIdentityCommand({ fullCommandName: 'appcircle-signing-identity-unknown', data: [] })

      expect(table).not.toHaveBeenCalled()
      expect(log).not.toHaveBeenCalled()
      expect(info).not.toHaveBeenCalled()
    })

    it('renders the deprecated build-profile-workflows command like workflow-list', () => {
      writeBuildCommand({
        fullCommandName: 'appcircle-build-profile-workflows',
        data: [{ id: 'wf-1', workflowName: 'Default' }]
      })

      expect(printedTable()).toEqual([
        { 'Workflow Id': 'wf-1', 'Workflow Name': 'Default', 'Last Used': 'No previous builds' }
      ])
    })

    it('routes publish-flow-list to the publish flow table', () => {
      writePublishCommand({
        fullCommandName: 'appcircle-publish-profile-publish-flow-list',
        data: [{ id: 'f1', flowName: 'Release flow' }]
      })

      expect(printedTable()).toEqual([{ Id: 'f1', Name: 'Release flow' }])
    })

    it('prints a message when there is no publish flow', () => {
      writePublishCommand({ fullCommandName: 'appcircle-publish-profile-publish-flow-list', data: [] })

      expect(table).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalledWith('  No publish flow found')
    })
  })

  describe('testing groups', () => {
    it('shows "-" for testing groups without id or name', () => {
      writeTestingGroupList({ data: [{}] })

      expect(printedTable()).toEqual([{ ID: '-', Name: '-' }])
    })

    it('shows "-" for a testing group view without id or name', () => {
      writeTestingGroupView({ data: { testers: [] } })

      expect(printedTable()).toEqual({ ID: '-', Name: '-', Created: '-', Updated: '-' })
      expect(log).toHaveBeenCalledWith('  No tester available')
    })
  })

  describe('build lists without data', () => {
    it.each([
      ['workflow list', writeBuildWorkflowList],
      ['configuration list', writeBuildConfigurationList],
      ['variable group list', writeBuildVariableGroupList],
      ['variable view', writeBuildVariableView]
    ])('prints an empty table for the %s when no data came back', (_name, writer) => {
      writer({})

      expect(table).toHaveBeenCalledWith([])
    })
  })

  describe('publish fallbacks', () => {
    it('shows "-" for a publish version without an id', () => {
      writePublishProfileVersionList({ data: [{ version: '1.0', versionCode: '5', name: 'App' }] })

      expect(printedTable()).toEqual([
        {
          'App Version Id': '-',
          'Version/App Name': '1.0(5) - App',
          'Binary Received': '-',
          'Release Candidate': '-',
          'File Size': '-',
          'Last Step': 'No previous builds'
        }
      ])
    })

    it('shows "-" for a publish version view without an id', () => {
      writePublishProfileVersionView({ data: { summary: 'notes', uniqueName: 'u' } })

      expect(printedTable()).toMatchObject({ 'App Version Id': '-', ReleaseNotes: 'notes', 'Unique Name': 'u' })
    })

    it('shows "-" for optional active publish fields', () => {
      writePublishActiveList({ data: [{ profileName: 'Store', os: 1, queueItemStatus: 0 }] })

      expect(printedTable()).toEqual([
        {
          'Publish Id': '-',
          'Profile Name': 'Store',
          'Step Name': '-',
          Status: 'Waiting',
          'Started By': '-',
          Started: '-',
          'Target OS': 'iOS',
          'Profile Id': '-',
          'App Version Id': '-'
        }
      ])
    })

    it('shows "-" for a publish without id and a message when it has no steps', () => {
      writePublishView({ data: { status: 0 } })

      expect(printedTable()).toEqual({ 'Publish Id': '-', Status: 'Success', 'Started On': '-' })
      expect(log).toHaveBeenCalledWith('  No step available')
      expect(table).toHaveBeenCalledTimes(1)
    })

    it('shows "-" for a publish step without a name', () => {
      writePublishView({ data: { id: 'p1', steps: [{ status: 1 }] } })

      expect(table.mock.calls[1][0]).toEqual([
        { Name: '-', Status: 'Failed', 'Started By': '-', 'Started On': '-', 'Finished On': '-' }
      ])
    })
  })

  describe('signing identity fallbacks', () => {
    it('shows "-" for certificate list fields that are missing', () => {
      writeSigningCertificateList({ data: [{ storeType: 0 }] })

      expect(printedTable()).toEqual([
        {
          'Certificate Id': '-',
          'Certificate Name': '-',
          'Stored By': 'Appcircle',
          Extension: '-',
          'Expire Date': '-'
        }
      ])
    })

    it('shows "-" for uploaded certificate fields that are missing', () => {
      writeSigningCertificateUpload({ data: { storeType: 1 } })

      expect(printedTable()).toEqual({
        'Certificate Id': '-',
        'Certificate Name': '-',
        'Stored By': 'App Store',
        'File Name': '-',
        'Expire Date': '-'
      })
    })

    it('shows "-" for created certificate fields and a message when nothing was created', () => {
      writeSigningCertificateCreate({ data: { storeType: 0 } })
      writeSigningCertificateCreate({ data: null })

      expect(printedTable()).toEqual({
        'Certificate Id': '-',
        'Certificate Name': '-',
        'Stored By': 'Appcircle',
        Created: '-'
      })
      expect(log).toHaveBeenCalledWith('  No iOS certificate found')
    })

    it('shows "-" for certificate view fields and a message when the certificate is missing', () => {
      writeSigningCertificateView({ data: {} })
      writeSigningCertificateView({ data: undefined })

      expect(printedTable()).toEqual({
        'Certificate Id': '-',
        'Certificate Name': '-',
        'File Name': '-',
        'Stored By': '-',
        'Expire Date': '-',
        Created: '-',
        Updated: '-'
      })
      expect(log).toHaveBeenCalledWith('  No iOS certificate found')
    })

    it('shows "-" for keystore list and view fields that are missing', () => {
      writeSigningKeystoreList({ data: [{}] })
      writeSigningKeystoreView({ data: {} })

      expect(table.mock.calls[0][0]).toEqual([
        { 'Keystore Id': '-', 'Keystore Name': '-', 'File Name': '-', Expires: '-' }
      ])
      expect(table.mock.calls[1][0]).toEqual({
        'Keystore Id': '-',
        'Keystore Name': '-',
        Alias: '-',
        'File Name': '-',
        Created: '-',
        Expires: '-'
      })
    })

    it('shows defaults for provisioning profile list and view fields that are missing', () => {
      writeSigningProvisioningProfileList({ data: [{}] })
      writeSigningProvisioningProfileView({ data: {} })

      expect(table.mock.calls[0][0]).toEqual([
        { Id: '-', Name: '-', 'Associated App ID': '-', 'Stored By': '-', 'Has Certificate': false, Expires: '-' }
      ])
      expect(table.mock.calls[1][0]).toEqual({
        Id: '-',
        Name: '-',
        'Associated App ID': '-',
        'Stored By': '-',
        'Has Certificate': false,
        Expires: '-',
        Created: '-'
      })
    })
  })
})
