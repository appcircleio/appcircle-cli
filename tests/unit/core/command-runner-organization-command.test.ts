/**
 * Tests for handleOrganizationCommand: organization/user resolution, role commands,
 * user view/invite/re-invite/remove, sub-organization creation and the unknown-command fallback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  getOrganizations: vi.fn(),
  getUserInfo: vi.fn(),
  getOrganizationUsersWithRoles: vi.fn(),
  getOrganizationDetail: vi.fn(),
  getOrganizationInvitations: vi.fn(),
  inviteUserToOrganization: vi.fn(),
  reInviteUserToOrganization: vi.fn(),
  getOrganizationUserinfo: vi.fn(),
  removeInvitationFromOrganization: vi.fn(),
  removeUserFromOrganization: vi.fn(),
  assignRolesToUserInOrganitaion: vi.fn(),
  createSubOrganization: vi.fn(),
}));

const spinner = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  succeed: vi.fn(),
  fail: vi.fn(),
  text: '',
}));

vi.mock('../../../src/services', () => svc);
vi.mock('../../../src/core/writer', () => ({ commandWriter: vi.fn(), configWriter: vi.fn() }));
vi.mock('enquirer', () => ({ default: { prompt: vi.fn() } }));
vi.mock('../../../src/utils/orahelper', () => ({
  createOra: vi.fn(() => spinner),
}));

import { handleOrganizationCommand } from '../../../src/core/command-runner';
import { commandWriter } from '../../../src/core/writer';
import enquirer from 'enquirer';
import { ProgramError } from '../../../src/core/ProgramError';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { CommandTypes } from '../../../src/core/commands';

const cmd = (name: string) => ({ fullCommandName: `appcircle-organization-${name}` }) as any;
const prompt = vi.mocked(enquirer.prompt);

describe('handleOrganizationCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spinner.start.mockReturnValue(spinner);
    spinner.text = '';
    svc.getUserInfo.mockResolvedValue({ currentOrganizationId: 'cur-org' });
  });

  describe('organization resolution', () => {
    it('resolves --organization name to its id when organizationId is missing/all/current', async () => {
      svc.getOrganizations.mockResolvedValue([{ id: 'o1', name: 'Org One' }, { id: 'o2', name: 'Org Two' }]);
      svc.getOrganizationDetail.mockResolvedValue({ id: 'o2' });
      for (const organizationId of [undefined, 'all', 'current']) {
        const params: any = { organization: 'Org Two', organizationId };
        await handleOrganizationCommand(cmd('view'), params);
        expect(params.organizationId).toBe('o2');
      }
      expect(svc.getOrganizationDetail).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'o2' }));
    });

    it('keeps an explicit organizationId even when --organization is given', async () => {
      svc.getOrganizationDetail.mockResolvedValue({ id: 'explicit' });
      const params: any = { organization: 'Org Two', organizationId: 'explicit' };
      await handleOrganizationCommand(cmd('view'), params);
      expect(svc.getOrganizations).not.toHaveBeenCalled();
      expect(params.organizationId).toBe('explicit');
    });

    it('throws a ProgramError listing available organizations when the name is unknown', async () => {
      svc.getOrganizations.mockResolvedValue([{ id: 'o1', name: 'Org One' }]);
      const err = await handleOrganizationCommand(cmd('view'), { organization: 'Missing' }).catch((e) => e);
      expect(err).toBeInstanceOf(ProgramError);
      expect(err.message).toContain('Organization "Missing" not found.');
      expect(err.message).toContain('  - Org One');
    });

    it('falls back to the current organization when no organization is given', async () => {
      svc.getOrganizationDetail.mockResolvedValue({ id: 'cur-org' });
      const params: any = { organizationId: 'current' };
      await handleOrganizationCommand(cmd('view'), params);
      expect(params.organizationId).toBe('cur-org');
    });
  });

  describe('role command user resolution', () => {
    it('requires --userId or --user for role commands', async () => {
      const err = await handleOrganizationCommand(cmd('role-view'), { organizationId: 'o1' }).catch((e) => e);
      expect(err).toBeInstanceOf(ProgramError);
      expect(err.message).toBe('You must provide either --userId or --user parameter for this command.');
      expect(console.log).toHaveBeenCalled();
    });

    it('resolves --user by email or full name', async () => {
      svc.getOrganizationUsersWithRoles.mockResolvedValue([
        { id: 'u1', email: 'a@x.io', fullName: 'Alice' },
        { id: 'u2', email: 'b@x.io', fullName: 'Bob' },
      ]);
      svc.getOrganizationUserinfo.mockResolvedValue({ roles: ['r1'], inheritedRoles: ['r2'] });

      const byEmail: any = { organizationId: 'o1', user: 'b@x.io' };
      await handleOrganizationCommand(cmd('role-view'), byEmail);
      expect(byEmail.userId).toBe('u2');

      const byName: any = { organizationId: 'o1', user: 'Alice' };
      await handleOrganizationCommand(cmd('role-view'), byName);
      expect(byName.userId).toBe('u1');
      expect(svc.getOrganizationUsersWithRoles).toHaveBeenCalledWith({ organizationId: 'o1' });
    });

    it('does not look up users when userId is already provided', async () => {
      svc.getOrganizationUserinfo.mockResolvedValue({ roles: [], inheritedRoles: [] });
      await handleOrganizationCommand(cmd('role-view'), { organizationId: 'o1', userId: 'u9', user: 'x' });
      expect(svc.getOrganizationUsersWithRoles).not.toHaveBeenCalled();
      expect(svc.getOrganizationUserinfo).toHaveBeenCalledWith({ organizationId: 'o1', userId: 'u9' });
    });

    it('throws with the user list (using a placeholder for missing names) when --user is unknown', async () => {
      svc.getOrganizationUsersWithRoles.mockResolvedValue([
        { id: 'u1', email: 'a@x.io', fullName: 'Alice' },
        { id: 'u2', email: 'c@x.io' },
      ]);
      const err = await handleOrganizationCommand(cmd('role-add'), { organizationId: 'o1', user: 'zzz' }).catch((e) => e);
      expect(err).toBeInstanceOf(ProgramError);
      expect(err.message).toContain('User "zzz" not found in organization.');
      expect(err.message).toContain('  - a@x.io (Alice)');
      expect(err.message).toContain('  - c@x.io (No name)');
    });
  });

  describe('user-remove user resolution', () => {
    it('resolves --user to userId before removal', async () => {
      svc.getOrganizationUsersWithRoles.mockResolvedValue([{ id: 'u1', email: 'a@x.io', fullName: 'Alice' }]);
      svc.getOrganizationUserinfo.mockResolvedValue({ email: 'a@x.io' });
      prompt.mockResolvedValue({ confirm: 'no' } as any);
      const byName: any = { organizationId: 'o1', user: 'Alice' };
      await handleOrganizationCommand(cmd('user-remove'), byName);
      expect(byName.userId).toBe('u1');
      const byEmail: any = { organizationId: 'o1', user: 'a@x.io' };
      await handleOrganizationCommand(cmd('user-remove'), byEmail);
      expect(byEmail.userId).toBe('u1');
    });

    it('throws when --user is not in the organization', async () => {
      svc.getOrganizationUsersWithRoles.mockResolvedValue([
        { id: 'u1', email: 'a@x.io', fullName: 'Alice' },
        { id: 'u2', email: 'n@x.io' },
      ]);
      const err = await handleOrganizationCommand(cmd('user-remove'), { organizationId: 'o1', user: 'nobody' }).catch((e) => e);
      expect(err).toBeInstanceOf(ProgramError);
      expect(err.message).toContain('User "nobody" not found in organization.');
      expect(err.message).toContain('  - a@x.io (Alice)');
      expect(err.message).toContain('  - n@x.io (No name)');
    });
  });

  describe('organization view', () => {
    it('lists all organizations when organizationId is "all"', async () => {
      svc.getOrganizations.mockResolvedValue([{ id: 'o1' }]);
      await handleOrganizationCommand(cmd('view'), { organizationId: 'all' });
      expect(svc.getOrganizationDetail).not.toHaveBeenCalled();
      expect(spinner.succeed).toHaveBeenCalled();
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ORGANIZATION, {
        fullCommandName: 'appcircle-organization-view',
        data: [{ id: 'o1' }],
      });
    });

    it('lists all organizations when the current organization id resolves to empty', async () => {
      svc.getUserInfo.mockResolvedValue({ currentOrganizationId: '' });
      svc.getOrganizations.mockResolvedValue([{ id: 'only' }]);
      await handleOrganizationCommand(cmd('view'), {});
      expect(svc.getOrganizations).toHaveBeenCalled();
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ORGANIZATION, expect.objectContaining({ data: [{ id: 'only' }] }));
    });

    it('stops the spinner and rethrows on API failure', async () => {
      svc.getOrganizationDetail.mockRejectedValue(new Error('boom'));
      await expect(handleOrganizationCommand(cmd('view'), { organizationId: 'o1' })).rejects.toThrow('boom');
      expect(spinner.stop).toHaveBeenCalled();
      expect(commandWriter).not.toHaveBeenCalled();
    });
  });

  describe('organization user view', () => {
    it('writes users and invitations', async () => {
      svc.getOrganizationUsersWithRoles.mockResolvedValue([{ id: 'u1' }]);
      svc.getOrganizationInvitations.mockResolvedValue([{ email: 'i@x.io' }]);
      await handleOrganizationCommand(cmd('user-view'), { organizationId: 'o1' });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ORGANIZATION, {
        fullCommandName: 'appcircle-organization-user-view',
        data: { users: [{ id: 'u1' }], invitations: [{ email: 'i@x.io' }] },
      });
    });

    it('stops the spinner and rethrows on failure', async () => {
      svc.getOrganizationUsersWithRoles.mockRejectedValue(new Error('users failed'));
      await expect(handleOrganizationCommand(cmd('user-view'), { organizationId: 'o1' })).rejects.toThrow('users failed');
      expect(spinner.stop).toHaveBeenCalled();
    });
  });

  describe('invite and re-invite', () => {
    it('invites a user with the given roles', async () => {
      await handleOrganizationCommand(cmd('user-invite'), { organizationId: 'o1', email: 'n@x.io', role: ['ADMIN'] });
      expect(svc.inviteUserToOrganization).toHaveBeenCalledWith({ organizationId: 'o1', email: 'n@x.io', role: ['ADMIN'] });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ORGANIZATION, {
        fullCommandName: 'appcircle-organization-user-invite',
        data: 'Invitation successfully sent.',
      });
    });

    it('wraps a single role into an array', async () => {
      await handleOrganizationCommand(cmd('user-invite'), { organizationId: 'o1', email: 'n@x.io', role: 'DEV' });
      expect(svc.inviteUserToOrganization).toHaveBeenCalledWith({ organizationId: 'o1', email: 'n@x.io', role: ['DEV'] });
    });

    it('re-invites using the given organization', async () => {
      await handleOrganizationCommand(cmd('user-re-invite'), { organizationId: 'o1', email: 'n@x.io' });
      expect(svc.reInviteUserToOrganization).toHaveBeenCalledWith({ organizationId: 'o1', email: 'n@x.io' });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ORGANIZATION, {
        fullCommandName: 'appcircle-organization-user-re-invite',
        data: 'Re-Invitation successfully sent.',
      });
    });

    it('re-invite falls back to the current organization when the resolved id is empty', async () => {
      svc.getUserInfo
        .mockResolvedValueOnce({ currentOrganizationId: '' })
        .mockResolvedValueOnce({ currentOrganizationId: 'second-lookup' });
      await handleOrganizationCommand(cmd('user-re-invite'), { email: 'n@x.io' });
      expect(svc.getUserInfo).toHaveBeenCalledTimes(2);
      expect(svc.reInviteUserToOrganization).toHaveBeenCalledWith({ organizationId: 'second-lookup', email: 'n@x.io' });
    });
  });

  describe('user remove', () => {
    it('requires email or userId', async () => {
      const err = await handleOrganizationCommand(cmd('user-remove'), { organizationId: 'o1' }).catch((e) => e);
      expect(err).toBeInstanceOf(AppcircleExitError);
      expect(err.code).toBe(1);
      expect(console.error).toHaveBeenCalledWith('error: You must provide either email or userId parameter');
    });

    it('cancels when the user answers no and names the user by email', async () => {
      svc.getOrganizationUserinfo.mockResolvedValue({ email: 'u@x.io' });
      prompt.mockResolvedValue({ confirm: 'no' } as any);
      await handleOrganizationCommand(cmd('user-remove'), { organizationId: 'o1', userId: 'u1' });
      expect((prompt.mock.calls[0][0] as any).message).toContain('delete the User "u@x.io"');
      expect(svc.removeUserFromOrganization).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('User/Invitation removal cancelled.'));
    });

    it('uses the userId in the prompt when user info has no email or cannot be fetched', async () => {
      prompt.mockResolvedValue({ confirm: 'no' } as any);
      svc.getOrganizationUserinfo.mockResolvedValueOnce({});
      await handleOrganizationCommand(cmd('user-remove'), { organizationId: 'o1', userId: 'u1' });
      expect((prompt.mock.calls[0][0] as any).message).toContain('delete the User "u1"');

      svc.getOrganizationUserinfo.mockRejectedValueOnce(new Error('nope'));
      await handleOrganizationCommand(cmd('user-remove'), { organizationId: 'o1', userId: 'u2' });
      expect((prompt.mock.calls[1][0] as any).message).toContain('delete the User "u2"');
    });

    it('removes a user after confirmation', async () => {
      svc.getOrganizationUserinfo.mockResolvedValue({ email: 'u@x.io' });
      prompt.mockResolvedValue({ confirm: 'yes' } as any);
      await handleOrganizationCommand(cmd('user-remove'), { organizationId: 'o1', userId: 'u1' });
      expect(svc.removeInvitationFromOrganization).not.toHaveBeenCalled();
      expect(svc.removeUserFromOrganization).toHaveBeenCalledWith({ organizationId: 'o1', userId: 'u1' });
      expect(spinner.succeed).toHaveBeenCalledWith('User removed from Organization successfully.\n\n');
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ORGANIZATION, {
        fullCommandName: 'appcircle-organization-user-remove',
        data: { email: 'u1' },
      });
    });

    it('removes an invitation by email after confirmation', async () => {
      prompt.mockResolvedValue({ confirm: 'yes' } as any);
      await handleOrganizationCommand(cmd('user-remove'), { organizationId: 'o1', email: 'inv@x.io' });
      expect((prompt.mock.calls[0][0] as any).message).toContain('delete the Invitation "inv@x.io"');
      expect(svc.removeInvitationFromOrganization).toHaveBeenCalledWith({ organizationId: 'o1', email: 'inv@x.io' });
      expect(svc.removeUserFromOrganization).not.toHaveBeenCalled();
      expect(spinner.succeed).toHaveBeenCalledWith('Invitation removed successfully.\n\n');
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ORGANIZATION, {
        fullCommandName: 'appcircle-organization-user-remove',
        data: { email: 'inv@x.io' },
      });
    });

    it('treats the unknown placeholder ("-") as not provided for both identifiers', async () => {
      prompt.mockResolvedValue({ confirm: 'yes' } as any);
      await handleOrganizationCommand(cmd('user-remove'), { organizationId: 'o1', email: '-', userId: '-' });
      expect((prompt.mock.calls[0][0] as any).message).toContain('delete the User "-"');
      expect(svc.getOrganizationUserinfo).not.toHaveBeenCalled();
      expect(svc.removeInvitationFromOrganization).not.toHaveBeenCalled();
      expect(svc.removeUserFromOrganization).not.toHaveBeenCalled();
    });

    it('fails the spinner and rethrows when removal fails', async () => {
      prompt.mockResolvedValue({ confirm: 'yes' } as any);
      svc.removeInvitationFromOrganization.mockRejectedValueOnce(new Error('remove failed'));
      await expect(
        handleOrganizationCommand(cmd('user-remove'), { organizationId: 'o1', email: 'inv@x.io' })
      ).rejects.toThrow('remove failed');
      expect(spinner.fail).toHaveBeenCalledWith('Failed to remove from Organization');
    });
  });

  describe('role commands', () => {
    it('role-view writes roles and inherited roles', async () => {
      svc.getOrganizationUserinfo.mockResolvedValue({ roles: ['A'], inheritedRoles: ['B'] });
      await handleOrganizationCommand(cmd('role-view'), { organizationId: 'o1', userId: 'u1' });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ORGANIZATION, {
        fullCommandName: 'appcircle-organization-role-view',
        data: { roles: ['A'], inheritedRoles: ['B'] },
      });
    });

    it('role-add merges existing and new roles without duplicates', async () => {
      svc.getOrganizationUserinfo
        .mockResolvedValueOnce({ roles: ['A', 'B'] })
        .mockResolvedValueOnce({ roles: ['A', 'B', 'C'] });
      await handleOrganizationCommand(cmd('role-add'), { organizationId: 'o1', userId: 'u1', role: ['B', 'C'] });
      expect(svc.assignRolesToUserInOrganitaion).toHaveBeenCalledWith({ organizationId: 'o1', userId: 'u1', role: ['A', 'B', 'C'] });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ORGANIZATION, {
        fullCommandName: 'appcircle-organization-role-add',
        data: ['A', 'B', 'C'],
      });
    });

    it('role-remove returns early when no role is selected', async () => {
      svc.getOrganizationUserinfo.mockResolvedValue({ email: 'u@x.io', roles: ['A'] });
      await handleOrganizationCommand(cmd('role-remove'), { organizationId: 'o1', userId: 'u1', role: [] });
      expect(prompt).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No roles selected for removal.'));
    });

    it('role-remove wraps an undefined role into [undefined] and still prompts', async () => {
      svc.getOrganizationUserinfo.mockResolvedValue({ email: 'u@x.io', roles: ['A'] });
      prompt.mockResolvedValue({ confirm: 'no' } as any);
      await handleOrganizationCommand(cmd('role-remove'), { organizationId: 'o1', userId: 'u1' });
      // params.role becomes [undefined], which is a non-empty array, so the prompt is shown
      expect(prompt).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Role removal cancelled.'));
      expect(svc.assignRolesToUserInOrganitaion).not.toHaveBeenCalled();
    });

    it('role-remove removes the selected roles after confirmation', async () => {
      svc.getOrganizationUserinfo
        .mockResolvedValueOnce({ email: 'u@x.io', roles: ['A', 'B', 'C'] })
        .mockResolvedValueOnce({ roles: ['A'] });
      prompt.mockResolvedValue({ confirm: 'yes' } as any);
      await handleOrganizationCommand(cmd('role-remove'), { organizationId: 'o1', userId: 'u1', role: ['B', 'C'] });
      expect((prompt.mock.calls[0][0] as any).message).toContain('remove role(s) "B, C" from User "u@x.io"');
      expect(svc.assignRolesToUserInOrganitaion).toHaveBeenCalledWith({ organizationId: 'o1', userId: 'u1', role: ['A'] });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ORGANIZATION, {
        fullCommandName: 'appcircle-organization-role-remove',
        data: ['A'],
      });
    });

    it('role-clear cancels on no', async () => {
      svc.getOrganizationUserinfo.mockResolvedValue({ email: 'u@x.io', roles: ['A'] });
      prompt.mockResolvedValue({ confirm: 'no' } as any);
      await handleOrganizationCommand(cmd('role-clear'), { organizationId: 'o1', userId: 'u1' });
      expect(svc.assignRolesToUserInOrganitaion).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Role clear operation cancelled.'));
    });

    it('role-clear removes all roles after confirmation', async () => {
      svc.getOrganizationUserinfo
        .mockResolvedValueOnce({ email: 'u@x.io', roles: ['A'] })
        .mockResolvedValueOnce({ roles: [] });
      prompt.mockResolvedValue({ confirm: 'yes' } as any);
      await handleOrganizationCommand(cmd('role-clear'), { organizationId: 'o1', userId: 'u1' });
      expect((prompt.mock.calls[0][0] as any).message).toContain('remove all roles from User "u@x.io"');
      expect(svc.assignRolesToUserInOrganitaion).toHaveBeenCalledWith({ organizationId: 'o1', userId: 'u1', role: [] });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ORGANIZATION, {
        fullCommandName: 'appcircle-organization-role-clear',
        data: [],
      });
    });
  });

  describe('create-sub', () => {
    it('reports success', async () => {
      svc.createSubOrganization.mockResolvedValue({});
      await handleOrganizationCommand(cmd('create-sub'), { organizationId: 'o1', name: 'Child' });
      expect(svc.createSubOrganization).toHaveBeenCalledWith({ name: 'Child' });
      expect(spinner.succeed).toHaveBeenCalledWith('Child sub organization created successfully!');
    });

    it('reports the API message, the error message, or a default text on failure', async () => {
      svc.createSubOrganization.mockRejectedValueOnce({ response: { data: { message: 'api says no' } } });
      await handleOrganizationCommand(cmd('create-sub'), { organizationId: 'o1', name: 'Child' });
      expect(spinner.fail).toHaveBeenLastCalledWith('Error: api says no');

      svc.createSubOrganization.mockRejectedValueOnce(new Error('plain error'));
      await handleOrganizationCommand(cmd('create-sub'), { organizationId: 'o1', name: 'Child' });
      expect(spinner.fail).toHaveBeenLastCalledWith('Error: plain error');

      svc.createSubOrganization.mockRejectedValueOnce({});
      await handleOrganizationCommand(cmd('create-sub'), { organizationId: 'o1', name: 'Child' });
      expect(spinner.fail).toHaveBeenLastCalledWith('Error: Failed to create sub-organization');
    });
  });

  describe('unknown command', () => {
    it('prints the long description when the command exists', async () => {
      await handleOrganizationCommand({ fullCommandName: 'appcircle-organization' } as any, { organizationId: 'o1' });
      const msg = vi.mocked(console.error).mock.calls[0][0] as string;
      expect(msg.startsWith('\n')).toBe(true);
      expect(msg).not.toContain('command not found');
    });

    it('prints "command not found" when no description exists', async () => {
      await handleOrganizationCommand(cmd('does-not-exist'), { organizationId: 'o1' });
      expect(console.error).toHaveBeenCalledWith('"appcircle organization does not exist ..." command not found.');
    });
  });
});
