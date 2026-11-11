/**
 * Unit tests for the "print the command help, then fail" branch of the parameter
 * validators in command-runner.
 *
 * The validators look up the help text with getLongDescriptionForCommand, which splits the
 * name on "-" and walks the Commands registry. With the real registry this lookup never
 * matches these commands: some validators pass a space-joined name
 * ("enterprise app store version publish"), and the hyphen split also breaks top-level
 * names that contain "-" ("testing-distribution"). To test the help-printing branch, this
 * file adds registry entries whose names match the keys the validators really look up.
 */
import { describe, it, expect, vi } from 'vitest';
import * as services from '../../../src/services';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { ProgramError } from '../../../src/core/ProgramError';
import {
  validateEnterpriseProfileParams,
  validateEnterpriseAppVersionParams,
  validateDistributionProfileParams,
  validateTestingGroupParams,
  validateCertificateParams,
  validateKeystoreParams,
  validateProvisioningProfileParams,
} from '../../../src/core/command-runner';

vi.mock('../../../src/core/commands', async (importOriginal) => {
  const actual: any = await importOriginal();
  const extra = [
    { command: 'enterprise app store version publish', description: 'short', longDescription: 'HELP enterprise publish' },
    { command: 'signing identity certificate view', description: 'HELP certificate view' },
    { command: 'signing identity keystore view', description: 'HELP keystore view' },
    { command: 'signing identity provisioning profile view', description: 'HELP provisioning view' },
    {
      command: 'testing',
      description: 'testing',
      subCommands: [
        {
          command: 'distribution',
          description: 'distribution',
          subCommands: [
            { command: 'upload', description: 'HELP distribution upload' },
            {
              command: 'testing',
              description: 'testing',
              subCommands: [
                {
                  command: 'group',
                  description: 'group',
                  subCommands: [{ command: 'view', description: 'HELP testing group view' }],
                },
              ],
            },
          ],
        },
      ],
    },
  ];
  return { ...actual, Commands: [...actual.Commands, ...extra] };
});

vi.mock('../../../src/services', async (importOriginal) => {
  const actual: any = await importOriginal();
  const mocked: any = {};
  for (const [key, value] of Object.entries(actual)) {
    mocked[key] = typeof value === 'function' ? vi.fn() : value;
  }
  return mocked;
});

const svc = services as any;
const cmd = (name: string) => ({ fullCommandName: `appcircle-${name}` }) as any;

describe('parameter validators print the command help before failing when a registry entry matches the lookup key', () => {
  it('validateEnterpriseProfileParams', async () => {
    await expect(validateEnterpriseProfileParams(cmd('enterprise-app-store-version-publish'), {})).rejects.toThrow(
      new ProgramError('Either --entProfileId or --entProfile parameter is required.'),
    );
    expect(console.log).toHaveBeenCalledWith('\nHELP enterprise publish');
    expect(svc.getEnterpriseProfiles).not.toHaveBeenCalled();
  });

  it('validateEnterpriseAppVersionParams', async () => {
    await expect(
      validateEnterpriseAppVersionParams(cmd('enterprise-app-store-version-publish'), { entProfileId: 'p' }),
    ).rejects.toThrow(new ProgramError('Either --entVersionId or --entVersion parameter is required.'));
    expect(console.log).toHaveBeenCalledWith('\nHELP enterprise publish');
  });

  it('validateDistributionProfileParams without a profile', async () => {
    await expect(
      validateDistributionProfileParams(cmd('testing-distribution-upload'), { app: 'a.ipa' }),
    ).rejects.toMatchObject({ message: 'Either --distProfileId or --distProfile parameter is required', code: 1 });
    expect(console.error).toHaveBeenCalledWith('\nHELP distribution upload\n');
  });

  it('validateDistributionProfileParams without an app', async () => {
    const err = await validateDistributionProfileParams(cmd('testing-distribution-upload'), { distProfileId: 'd' }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(AppcircleExitError);
    expect(err.message).toBe(
      'The --app parameter is required. Please provide the path to your app file (.ipa for iOS, .apk/.aab for Android).',
    );
    expect(console.error).toHaveBeenCalledWith('\nHELP distribution upload\n');
    expect(svc.getDistributionProfiles).not.toHaveBeenCalled();
  });

  it('validateTestingGroupParams', async () => {
    await expect(
      validateTestingGroupParams(cmd('testing-distribution-testing-group-view'), {}),
    ).rejects.toMatchObject({ message: 'Either --testingGroupId or --testingGroup parameter is required', code: 1 });
    expect(console.error).toHaveBeenCalledWith('\nHELP testing group view\n');
  });

  it('validateCertificateParams', async () => {
    await expect(validateCertificateParams(cmd('signing-identity-certificate-view'), {})).rejects.toThrow(
      new ProgramError('Either --certificateBundleId, --certificateId, or --certificate parameter is required.'),
    );
    expect(console.log).toHaveBeenCalledWith('\nHELP certificate view');
  });

  it('validateKeystoreParams', async () => {
    await expect(validateKeystoreParams(cmd('signing-identity-keystore-view'), {})).rejects.toThrow(
      new ProgramError('Either --keystoreId or --keystore parameter is required.'),
    );
    expect(console.log).toHaveBeenCalledWith('\nHELP keystore view');
  });

  it('validateProvisioningProfileParams', async () => {
    await expect(
      validateProvisioningProfileParams(cmd('signing-identity-provisioning-profile-view'), {}),
    ).rejects.toThrow(
      new ProgramError('Either --provisioningProfileId or --provisioningProfile parameter is required.'),
    );
    expect(console.log).toHaveBeenCalledWith('\nHELP provisioning view');
  });
});
