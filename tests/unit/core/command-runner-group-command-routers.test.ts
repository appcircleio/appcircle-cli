/**
 * Routing tests for handleDistributionCommand, handleSigningIdentityCommand and
 * handleEnterpriseAppStoreCommand: every sub-command reaches its handler, and unknown
 * sub-commands fall back to the help text or a "command not found" message.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';

const h = vi.hoisted(() => {
  const spinner: any = { text: '' };
  spinner.start = vi.fn(() => spinner);
  spinner.stop = vi.fn(() => spinner);
  spinner.succeed = vi.fn(() => spinner);
  spinner.fail = vi.fn(() => spinner);
  return { spinner, commands: { override: undefined as any }, prompt: vi.fn() };
});

vi.mock('../../../src/utils/orahelper', () => ({ createOra: vi.fn(() => h.spinner) }));
vi.mock('../../../src/services');
vi.mock('../../../src/core/writer', () => ({ commandWriter: vi.fn(), configWriter: vi.fn() }));
vi.mock('enquirer', () => ({ default: { prompt: h.prompt } }));
vi.mock('../../../src/core/commands', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    get Commands() {
      return h.commands.override ?? actual.Commands;
    },
  };
});

import {
  handleDistributionCommand,
  handleSigningIdentityCommand,
  handleEnterpriseAppStoreCommand,
  getLongDescriptionForCommand,
  findCommandByParts,
} from '../../../src/core/command-runner';
import * as services from '../../../src/services';
import { commandWriter } from '../../../src/core/writer';
import { CommandTypes } from '../../../src/core/commands';

const s = vi.mocked(services);

const cmd = (fullCommandName: string): any => ({
  fullCommandName,
  parent: null,
  name: () => fullCommandName.split('-').pop(),
  args: () => [],
  opts: () => ({}),
  isGroupCommand: (t: string) => fullCommandName.includes(`appcircle-${t}`),
});

type Route = {
  name: string;
  params: Record<string, any>;
  setup?: () => void;
  verify: (result: unknown) => void;
};

const run = async (handler: (c: any, p: any) => Promise<unknown>, route: Route) => {
  route.setup?.();
  const result = await handler(cmd(route.name), { ...route.params }).catch((e: unknown) => e);
  route.verify(result);
};

describe('group command routers', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    Object.values(services).forEach((fn: any) => {
      if (vi.isMockFunction(fn)) fn.mockReset();
    });
    h.prompt.mockReset();
    h.prompt.mockResolvedValue({ confirm: 'yes' });
    h.commands.override = undefined;
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    infoSpy.mockRestore();
  });

  describe('handleDistributionCommand', () => {
    const routes: Route[] = [
      {
        name: 'appcircle-testing-distribution-profile-list',
        params: {},
        setup: () => s.getDistributionProfiles.mockResolvedValue([{ id: 'd1' }] as any),
        verify: () =>
          expect(commandWriter).toHaveBeenCalledWith(CommandTypes.TESTING_DISTRIBUTION, {
            fullCommandName: 'appcircle-testing-distribution-profile-list',
            data: [{ id: 'd1' }],
          }),
      },
      {
        name: 'appcircle-testing-distribution-profile-create',
        params: { name: 'New' },
        setup: () => s.createDistributionProfile.mockResolvedValue({ id: 'd2' } as any),
        verify: () => {
          expect(s.createDistributionProfile).toHaveBeenCalledWith({ name: 'New' });
          expect(commandWriter).toHaveBeenCalledWith(CommandTypes.TESTING_DISTRIBUTION, {
            fullCommandName: 'appcircle-testing-distribution-profile-create',
            data: { id: 'd2', name: 'New' },
          });
        },
      },
      {
        name: 'appcircle-testing-distribution-upload',
        params: { distProfileId: 'd1', app: 'app.ipa' },
        setup: () => s.getDistributionProfiles.mockResolvedValue([] as any),
        verify: (result) => {
          expect(s.getDistributionProfiles).toHaveBeenCalled();
          expect((result as Error).message).toBe('No Distribution Profile available');
        },
      },
      {
        name: 'appcircle-testing-distribution-profile-settings-auto-send',
        params: { distProfile: 'missing' },
        setup: () => s.getDistributionProfiles.mockResolvedValue([] as any),
        verify: (result) =>
          expect((result as Error).message).toBe('Distribution profile with name "missing" not found'),
      },
      {
        name: 'appcircle-testing-distribution-testing-group-list',
        params: {},
        setup: () => s.getTestingGroups.mockResolvedValue([{ id: 'g1' }] as any),
        verify: () =>
          expect(commandWriter).toHaveBeenCalledWith(CommandTypes.TESTING_DISTRIBUTION, {
            fullCommandName: 'appcircle-testing-distribution-testing-group-list',
            data: [{ id: 'g1' }],
          }),
      },
      {
        name: 'appcircle-testing-distribution-testing-group-view',
        params: { testingGroupId: 'g1' },
        setup: () => s.getTestingGroupById.mockResolvedValue({ id: 'g1', name: 'G' } as any),
        verify: () => {
          expect(s.getTestingGroupById).toHaveBeenCalledWith({ testingGroupId: 'g1' });
          expect(commandWriter).toHaveBeenCalledWith(CommandTypes.TESTING_DISTRIBUTION, {
            fullCommandName: 'appcircle-testing-distribution-testing-group-view',
            data: { id: 'g1', name: 'G' },
          });
        },
      },
      {
        name: 'appcircle-testing-distribution-testing-group-create',
        params: { name: 'QA' },
        setup: () => s.createTestingGroup.mockResolvedValue({ id: 'g2', name: 'QA' } as any),
        verify: () => {
          expect(s.createTestingGroup).toHaveBeenCalledWith({ name: 'QA' });
          expect(infoSpy).toHaveBeenCalledWith('Testing Group named QA created successfully!');
        },
      },
      {
        name: 'appcircle-testing-distribution-testing-group-remove',
        params: { testingGroupId: 'g1' },
        setup: () => s.getTestingGroupById.mockResolvedValue({ id: 'g1', name: 'G' } as any),
        verify: () => expect(s.deleteTestingGroup).toHaveBeenCalledWith({ testingGroupId: 'g1' }),
      },
      {
        name: 'appcircle-testing-distribution-testing-group-tester-add',
        params: { testingGroupId: 'g1', testerEmail: 'a@b.c' },
        verify: () =>
          expect(s.addTesterToTestingGroup).toHaveBeenCalledWith({ testingGroupId: 'g1', testerEmail: 'a@b.c' }),
      },
      {
        name: 'appcircle-testing-distribution-testing-group-tester-remove',
        params: { testingGroupId: 'g1', email: 'a@b.c' },
        verify: () =>
          expect(s.removeTesterFromTestingGroup).toHaveBeenCalledWith(
            expect.objectContaining({ testingGroupId: 'g1', email: 'a@b.c' })
          ),
      },
    ];

    it.each(routes.map((r) => [r.name, r] as const))('routes %s to its handler', async (_name, route) => {
      await run(handleDistributionCommand, route);
    });

    it('prints the long description for an unknown sub-command when one matches', async () => {
      h.commands.override = [{ command: 'testing', description: 'T', longDescription: 'TD LONG', params: [] }];
      await expect(handleDistributionCommand(cmd('appcircle-testing-distribution-nope'), {})).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith('\nTD LONG\n');
    });

    it('prints "command not found" for an unknown sub-command without help text', async () => {
      h.commands.override = [];
      await handleDistributionCommand(cmd('appcircle-testing-distribution-nope'), {});
      expect(errorSpy).toHaveBeenCalledWith('"appcircle testing distribution nope ..." command not found.');
    });
  });

  describe('handleSigningIdentityCommand', () => {
    const routes: Route[] = [
      {
        name: 'appcircle-signing-identity-certificate-list',
        params: {},
        setup: () => {
          s.getiOSP12Certificates.mockResolvedValue([{ id: 'p12' }] as any);
          s.getiOSCSRCertificates.mockResolvedValue([{ id: 'csr' }] as any);
        },
        verify: () =>
          expect(commandWriter).toHaveBeenCalledWith(CommandTypes.SIGNING_IDENTITY, {
            fullCommandName: 'appcircle-signing-identity-certificate-list',
            data: [{ id: 'p12' }, { id: 'csr' }],
          }),
      },
      {
        name: 'appcircle-signing-identity-certificate-upload',
        params: { path: 'cert.p12', password: 'pw' },
        setup: () => s.uploadP12Certificate.mockResolvedValue({ id: 'up' } as any),
        verify: () =>
          expect(s.uploadP12Certificate).toHaveBeenCalledWith(
            expect.objectContaining({ path: '/mock/resolved/cert.p12' })
          ),
      },
      {
        name: 'appcircle-signing-identity-certificate-create',
        params: { name: 'csr' },
        setup: () => s.createCSRCertificateRequest.mockResolvedValue({ id: 'c' } as any),
        verify: () => expect(s.createCSRCertificateRequest).toHaveBeenCalledWith({ name: 'csr' }),
      },
      {
        name: 'appcircle-signing-identity-certificate-view',
        params: { certificateBundleId: 'cb1' },
        setup: () => s.getCertificateDetailById.mockResolvedValue({ id: 'cb1' } as any),
        verify: () => {
          expect(s.getCertificateDetailById).toHaveBeenCalledWith({ certificateBundleId: 'cb1' });
          expect(commandWriter).toHaveBeenCalledWith(CommandTypes.SIGNING_IDENTITY, {
            fullCommandName: 'appcircle-signing-identity-certificate-view',
            data: { id: 'cb1' },
          });
        },
      },
      {
        name: 'appcircle-signing-identity-certificate-download',
        params: { certificateId: 'c1' },
        setup: () => s.getiOSP12Certificates.mockResolvedValue([{ id: 'c1', filename: 'c1.p12' }] as any),
        verify: () =>
          expect(s.downloadCertificateById).toHaveBeenCalledWith(
            { certificateId: 'c1', path: undefined },
            expect.anything(),
            'c1.p12',
            expect.anything()
          ),
      },
      {
        name: 'appcircle-signing-identity-certificate-remove',
        params: { certificateBundleId: 'c1', certificateId: 'c1' },
        setup: () => {
          s.getCertificateDetailById.mockResolvedValue({ id: 'c1', name: 'Cert' } as any);
          s.getiOSCSRCertificates.mockResolvedValue([] as any);
        },
        verify: () =>
          expect(s.removeCSRorP12CertificateById).toHaveBeenCalledWith(
            expect.objectContaining({ certificateId: 'c1' }),
            expect.any(String)
          ),
      },
      {
        name: 'appcircle-signing-identity-keystore-list',
        params: {},
        setup: () => s.getAndroidKeystores.mockResolvedValue([{ id: 'k1' }] as any),
        verify: () =>
          expect(commandWriter).toHaveBeenCalledWith(CommandTypes.SIGNING_IDENTITY, {
            fullCommandName: 'appcircle-signing-identity-keystore-list',
            data: [{ id: 'k1' }],
          }),
      },
      {
        name: 'appcircle-signing-identity-keystore-create',
        params: { name: 'ks' },
        verify: () => expect(s.generateNewKeystore).toHaveBeenCalledWith({ name: 'ks' }),
      },
      {
        name: 'appcircle-signing-identity-keystore-upload',
        params: { path: 'my.jks' },
        verify: () =>
          expect(s.uploadAndroidKeystoreFile).toHaveBeenCalledWith(
            expect.objectContaining({ path: '/mock/resolved/my.jks' })
          ),
      },
      {
        name: 'appcircle-signing-identity-keystore-download',
        params: { keystoreId: 'k1' },
        setup: () => s.getKeystoreDetailById.mockResolvedValue({ id: 'k1', fileName: 'k1.jks' } as any),
        verify: () =>
          expect(s.downloadKeystoreById).toHaveBeenCalledWith(
            { keystoreId: 'k1', path: undefined },
            expect.any(String),
            'k1.jks'
          ),
      },
      {
        name: 'appcircle-signing-identity-keystore-view',
        params: { keystoreId: 'k1' },
        setup: () => s.getKeystoreDetailById.mockResolvedValue({ id: 'k1' } as any),
        verify: () =>
          expect(commandWriter).toHaveBeenCalledWith(CommandTypes.SIGNING_IDENTITY, {
            fullCommandName: 'appcircle-signing-identity-keystore-view',
            data: { id: 'k1' },
          }),
      },
      {
        name: 'appcircle-signing-identity-keystore-remove',
        params: { keystoreId: 'k1' },
        setup: () => s.getKeystoreDetailById.mockResolvedValue({ id: 'k1', name: 'KS' } as any),
        verify: () => expect(s.removeKeystore).toHaveBeenCalledWith({ keystoreId: 'k1' }),
      },
      {
        name: 'appcircle-signing-identity-provisioning-profile-list',
        params: {},
        setup: () => s.getProvisioningProfiles.mockResolvedValue([{ id: 'pp1' }] as any),
        verify: () =>
          expect(commandWriter).toHaveBeenCalledWith(CommandTypes.SIGNING_IDENTITY, {
            fullCommandName: 'appcircle-signing-identity-provisioning-profile-list',
            data: [{ id: 'pp1' }],
          }),
      },
      {
        name: 'appcircle-signing-identity-provisioning-profile-upload',
        params: { path: 'p.mobileprovision' },
        verify: () =>
          expect(s.uploadProvisioningProfile).toHaveBeenCalledWith(
            expect.objectContaining({ path: '/mock/resolved/p.mobileprovision' })
          ),
      },
      {
        name: 'appcircle-signing-identity-provisioning-profile-download',
        params: { provisioningProfileId: 'pp1' },
        setup: () =>
          s.getProvisioningProfileDetailById.mockResolvedValue({ id: 'pp1', filename: 'pp1.mobileprovision' } as any),
        verify: () =>
          expect(s.downloadProvisioningProfileById).toHaveBeenCalledWith(
            { provisioningProfileId: 'pp1' },
            expect.any(String),
            'pp1.mobileprovision'
          ),
      },
      {
        name: 'appcircle-signing-identity-provisioning-profile-view',
        params: { provisioningProfileId: 'pp1' },
        setup: () => s.getProvisioningProfileDetailById.mockResolvedValue({ id: 'pp1' } as any),
        verify: () =>
          expect(commandWriter).toHaveBeenCalledWith(CommandTypes.SIGNING_IDENTITY, {
            fullCommandName: 'appcircle-signing-identity-provisioning-profile-view',
            data: { id: 'pp1' },
          }),
      },
      {
        name: 'appcircle-signing-identity-provisioning-profile-remove',
        params: { provisioningProfileId: 'pp1' },
        setup: () => s.getProvisioningProfileDetailById.mockResolvedValue({ id: 'pp1', name: 'PP' } as any),
        verify: () => expect(s.removeProvisioningProfile).toHaveBeenCalledWith({ provisioningProfileId: 'pp1' }),
      },
    ];

    it.each(routes.map((r) => [r.name, r] as const))('routes %s to its handler', async (_name, route) => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      await run(handleSigningIdentityCommand, route);
    });

    it('does nothing for an unknown signing identity sub-command', async () => {
      await expect(
        handleSigningIdentityCommand(cmd('appcircle-signing-identity-nope'), {})
      ).resolves.toBeUndefined();
      const called = Object.values(services).filter((fn: any) => vi.isMockFunction(fn) && fn.mock.calls.length > 0);
      expect(called).toHaveLength(0);
      expect(commandWriter).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleEnterpriseAppStoreCommand', () => {
    const routes: Route[] = [
      {
        name: 'appcircle-enterprise-app-store-profile-list',
        params: {},
        setup: () => s.getEnterpriseProfiles.mockResolvedValue([{ id: 'e1' }] as any),
        verify: () =>
          expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ENTERPRISE_APP_STORE, {
            fullCommandName: 'appcircle-enterprise-app-store-profile-list',
            data: [{ id: 'e1' }],
          }),
      },
      {
        name: 'appcircle-enterprise-app-store-version-list',
        params: { entProfileId: 'e1', publishType: '0' },
        setup: () => s.getEnterpriseAppVersions.mockResolvedValue([{ id: 'v1' }] as any),
        verify: () => {
          expect(s.getEnterpriseAppVersions).toHaveBeenCalledWith({ entProfileId: 'e1', publishType: '0' });
          expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ENTERPRISE_APP_STORE, {
            fullCommandName: 'appcircle-enterprise-app-store-version-list',
            data: [{ id: 'v1' }],
          });
        },
      },
      {
        name: 'appcircle-enterprise-app-store-version-publish',
        params: { entProfileId: 'e1', entVersionId: 'v1' },
        verify: (result) => expect((result as Error).message).toBe('Summary (--summary) is required'),
      },
      {
        name: 'appcircle-enterprise-app-store-version-unpublish',
        params: { entProfileId: 'e1', entVersionId: 'v1' },
        setup: () => s.unpublishEnterpriseAppVersion.mockResolvedValue({ ok: true } as any),
        verify: () => {
          expect(s.unpublishEnterpriseAppVersion).toHaveBeenCalledWith({ entProfileId: 'e1', entVersionId: 'v1' });
          expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ENTERPRISE_APP_STORE, {
            fullCommandName: 'appcircle-enterprise-app-store-version-unpublish',
            data: { ok: true },
          });
        },
      },
      {
        name: 'appcircle-enterprise-app-store-version-remove',
        params: { entProfileId: 'e1', entVersionId: 'v1' },
        setup: () => s.getEnterpriseAppVersions.mockResolvedValue([] as any),
        verify: (result) => {
          expect(s.getEnterpriseAppVersions).toHaveBeenCalledWith({ entProfileId: 'e1', publishType: '0' });
          expect((result as Error).message).toBe('App Version not found');
        },
      },
      {
        name: 'appcircle-enterprise-app-store-version-notify',
        params: { entProfileId: 'e1', entVersionId: 'v1' },
        setup: () => s.notifyEnterpriseAppVersion.mockResolvedValue({ taskId: 't1' } as any),
        verify: () => {
          expect(s.notifyEnterpriseAppVersion).toHaveBeenCalledWith({ entProfileId: 'e1', entVersionId: 'v1' });
          expect(h.spinner.succeed).toHaveBeenCalled();
        },
      },
      {
        name: 'appcircle-enterprise-app-store-version-upload-for-profile',
        params: { entProfileId: 'e1', app: 'app.ipa' },
        setup: () => s.getEnterpriseUploadInformation.mockRejectedValue(new Error('info failed')),
        verify: () =>
          expect(s.getEnterpriseUploadInformation).toHaveBeenCalledWith({ fileName: 'mock-file.json', fileSize: 1000 }),
      },
      {
        name: 'appcircle-enterprise-app-store-version-upload-without-profile',
        params: { app: 'app.ipa' },
        setup: () => s.getEnterpriseUploadInformation.mockRejectedValue(new Error('info failed')),
        verify: () =>
          expect(s.getEnterpriseUploadInformation).toHaveBeenCalledWith({ fileName: 'mock-file.json', fileSize: 1000 }),
      },
      {
        name: 'appcircle-enterprise-app-store-version-download-link',
        params: { entProfileId: 'e1', entVersionId: 'v1' },
        setup: () => s.getEnterpriseDownloadLink.mockResolvedValue({ url: 'https://x' } as any),
        verify: () =>
          expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ENTERPRISE_APP_STORE, {
            fullCommandName: 'appcircle-enterprise-app-store-version-download-link',
            data: { url: 'https://x' },
          }),
      },
    ];

    it.each(routes.map((r) => [r.name, r] as const))('routes %s to its handler', async (_name, route) => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      await run(handleEnterpriseAppStoreCommand, route);
    });

    it('prints the long description for an unknown sub-command when one matches', async () => {
      h.commands.override = [{ command: 'enterprise', description: 'E', longDescription: 'EAS LONG', params: [] }];
      await handleEnterpriseAppStoreCommand(cmd('appcircle-enterprise-app-store-nope'), {});
      expect(errorSpy).toHaveBeenCalledWith('\nEAS LONG\n');
    });

    it('prints "command not found" for an unknown sub-command without help text', async () => {
      h.commands.override = [];
      await handleEnterpriseAppStoreCommand(cmd('appcircle-enterprise-app-store-nope'), {});
      expect(errorSpy).toHaveBeenCalledWith('"appcircle enterprise app store nope ..." command not found.');
    });
  });

  describe('command help lookup', () => {
    const list: any[] = [
      { command: 'build', description: 'Build short', params: [] },
      {
        command: 'signing',
        description: 'Signing',
        longDescription: 'Signing long',
        params: [],
        subCommands: [{ command: 'list', description: 'List', params: [] }],
      },
    ];

    it('falls back to the short description when no long description exists', () => {
      h.commands.override = list;
      expect(getLongDescriptionForCommand('appcircle-build')).toBe('Build short');
      expect(getLongDescriptionForCommand('appcircle-signing')).toBe('Signing long');
      expect(getLongDescriptionForCommand('appcircle-unknown')).toBeUndefined();
    });

    it('returns the deepest command that matches the parts', () => {
      expect(findCommandByParts([], list)).toBeUndefined();
      expect(findCommandByParts(['signing', 'list'], list)).toBe(list[1].subCommands[0]);
      expect(findCommandByParts(['signing', 'nope'], list)).toBeUndefined();
      expect(findCommandByParts(['build', 'extra', 'parts'], list)).toBe(list[0]);
    });
  });
});
