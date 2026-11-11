/**
 * @fileoverview Main menu loop, authentication sub-menu, direct-command mode, sub-command
 * back/forward navigation and the exit handling of runCommandsInteractively.
 *
 * Note: the module remembers whether the logo was printed, so the logo test runs first.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';

const h = vi.hoisted(() => {
  const state = {
    answers: [] as any[],
    prompts: [] as any[],
    commands: [] as any[],
  };
  const next = (kind: string, cfg: any) => {
    state.prompts.push({ kind, ...cfg });
    if (state.answers.length === 0) {
      throw new Error(`No scripted answer for ${kind} prompt "${cfg?.name}"`);
    }
    const answer = state.answers.shift();
    return typeof answer === 'function' ? answer(cfg) : answer;
  };
  return { state, next };
});

vi.mock('enquirer', () => {
  const make = (kind: string) =>
    vi.fn(function (this: any, cfg: any) {
      this.run = async () => h.next(kind, cfg);
    });
  const mod = {
    AutoComplete: make('autocomplete'),
    BooleanPrompt: make('boolean'),
    Input: make('input'),
    Select: make('select'),
    Editor: make('editor'),
    prompt: vi.fn(),
  };
  return { ...mod, default: mod };
});

vi.mock('ora', () => ({
  default: vi.fn(() => {
    const spinner: any = { text: '' };
    spinner.start = vi.fn(() => spinner);
    spinner.stop = vi.fn(() => spinner);
    spinner.fail = vi.fn(() => spinner);
    return spinner;
  }),
}));

vi.mock('../../../src/services', () => ({
  getOrganizationInvitations: vi.fn(),
}));

vi.mock('../../../src/core/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/core/commands')>()),
  Commands: h.state.commands,
}));

vi.mock('../../../src/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/config')>()),
  readEnviromentConfigVariable: vi.fn(() => ''),
}));

vi.mock('../../../src/program', () => ({
  createCommandActionCallback: vi.fn((input: any) => ({ fullCommandName: input.name() })),
}));

vi.mock('../../../src/core/command-runner', () => ({
  runCommand: vi.fn(),
  validateCurrentTokenIsValid: vi.fn(),
  clearStoredToken: vi.fn(),
}));

import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { CommandParameterTypes } from '../../../src/core/commands';
import { readEnviromentConfigVariable } from '../../../src/config';
import { getOrganizationInvitations } from '../../../src/services';
import { runCommand, validateCurrentTokenIsValid, clearStoredToken } from '../../../src/core/command-runner';
import {
  runCommandsInteractivelyInner,
  runCommandsInteractively,
  handleAuthenticationSubMenu,
  handleSelectedCommand,
  handleBackNavigation,
  checkUserAuthenticationStatus,
  adjustCommandIndexForAuthGrouping,
} from '../../../src/core/interactive-runner';

const leaf = (command: string, description: string, extra: any = {}) => ({ command, description, params: [], ...extra });

const defaultCommands = () => [
  leaf('login', 'Login'),
  leaf('logout', 'Logout'),
  leaf('build', 'Build'),
  leaf('menu', 'Menu', { subCommands: [leaf('a', 'Sub A'), leaf('b', 'Sub B')] }),
  leaf('halt', 'Halt', { params: [{ name: 'email', type: CommandParameterTypes.SELECT }] }),
];

const MAIN_CHOICES = ['1. Authentication (Login/Logout)', '2. Build', '3. Menu', '4. Halt', '0. Exit'];

const answer = (...values: any[]) => h.state.answers.push(...values);
const originalArgv = process.argv;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  h.state.answers.length = 0;
  h.state.prompts.length = 0;
  h.state.commands.splice(0, h.state.commands.length, ...defaultCommands());
  vi.mocked(runCommand).mockReset();
  vi.mocked(validateCurrentTokenIsValid).mockReset();
  vi.mocked(readEnviromentConfigVariable).mockReset().mockReturnValue('');
  vi.mocked(getOrganizationInvitations).mockReset().mockRejectedValue(new Error('no invitations'));
  vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ version: '9.9.9' }));
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
  process.argv = ['node', 'appcircle'];
});

afterEach(() => {
  process.argv = originalArgv;
  exitSpy.mockRestore();
  expect(h.state.answers).toEqual([]);
});

describe('runCommandsInteractivelyInner - main menu', () => {
  it('prints the logo first, the "Main Menu" divider afterwards and remembers the last choice', async () => {
    process.argv = ['node', 'appcircle', '-i'];
    answer('2. Build', '0. Exit');

    const promise = runCommandsInteractivelyInner();
    await expect(promise).rejects.toBeInstanceOf(AppcircleExitError);
    await expect(promise).rejects.toMatchObject({ code: 0, message: 'User exited from main menu' });

    expect(runCommand).toHaveBeenCalledWith({ fullCommandName: 'build' });
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.info).mock.calls[0][0]).toContain('v9.9.9');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(' Main Menu '));
    expect(console.log).toHaveBeenCalledWith('Goodbye! 👋');
    expect(h.state.prompts[0]).toMatchObject({ choices: MAIN_CHOICES, initial: undefined });
    expect(h.state.prompts[1].initial).toBe(1);
  });

  it('runs the selected command once and stops in default mode', async () => {
    answer('2. Build');
    await expect(runCommandsInteractivelyInner()).resolves.toBeUndefined();
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(h.state.prompts).toHaveLength(1);
  });

  it('shows the menu again after going back from a sub-command menu', async () => {
    answer('3. Menu', (cfg: any) => {
      expect(cfg.choices).toEqual([
        { name: '1. Sub A', message: '1. Sub A' },
        { name: '2. Sub B', message: '2. Sub B' },
        { name: 'back', message: '⬅ Back' },
      ]);
      return 'back';
    }, '2. Build');
    await expect(runCommandsInteractivelyInner()).resolves.toBeUndefined();
    expect(runCommand).toHaveBeenCalledWith({ fullCommandName: 'build' });
  });

  it('stops after a command that was halted in default mode and re-shows it in interactive mode', async () => {
    answer('4. Halt');
    await expect(runCommandsInteractivelyInner()).resolves.toBeUndefined();
    expect(runCommand).not.toHaveBeenCalled();

    process.argv = ['node', 'appcircle', '--interactive'];
    answer('4. Halt', '0. Exit');
    await expect(runCommandsInteractivelyInner()).rejects.toMatchObject({ code: 0 });
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('treats an AppcircleExitError with code 0 from the command as a normal finish', async () => {
    vi.mocked(runCommand).mockRejectedValue(new AppcircleExitError('done', 0));
    answer('2. Build');
    await expect(runCommandsInteractivelyInner()).resolves.toBeUndefined();

    process.argv = ['node', 'appcircle', '-i'];
    answer('2. Build', '0. Exit');
    await expect(runCommandsInteractivelyInner()).rejects.toMatchObject({ code: 0, message: 'User exited from main menu' });
    expect(runCommand).toHaveBeenCalledTimes(2);
  });

  it('rethrows failing command errors', async () => {
    const failure = new AppcircleExitError('failed', 4);
    vi.mocked(runCommand).mockRejectedValueOnce(failure);
    answer('2. Build');
    await expect(runCommandsInteractivelyInner()).rejects.toBe(failure);

    const boom = new Error('boom');
    vi.mocked(runCommand).mockRejectedValueOnce(boom);
    answer('2. Build');
    await expect(runCommandsInteractivelyInner()).rejects.toBe(boom);
  });

  it('falls back to the main menu when the single argument is not a known command', async () => {
    process.argv = ['node', 'appcircle', 'unknown-cmd'];
    answer('2. Build');
    await expect(runCommandsInteractivelyInner()).resolves.toBeUndefined();
    expect(h.state.prompts[0].choices).toEqual(MAIN_CHOICES);
  });
});

describe('runCommandsInteractivelyInner - authentication group', () => {
  it('goes back, then runs logout', async () => {
    answer('1. Authentication (Login/Logout)', '⬅ Back', '1. Authentication (Login/Logout)', '2. Logout');
    await expect(runCommandsInteractivelyInner()).resolves.toBeUndefined();
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(runCommand).toHaveBeenCalledWith({ fullCommandName: 'logout' });
    expect(h.state.prompts[1]).toMatchObject({ name: 'authCommand', choices: ['1. Login', '2. Logout', '⬅ Back'] });
  });

  it('runs login when no token is stored and ignores unknown sub-menu answers', async () => {
    answer('1. Authentication (Login/Logout)', 'something else', '1. Authentication (Login/Logout)', '1. Login');
    await expect(runCommandsInteractivelyInner()).resolves.toBeUndefined();
    expect(runCommand).toHaveBeenCalledWith({ fullCommandName: 'login' });
    expect(readEnviromentConfigVariable).toHaveBeenCalledWith('AC_ACCESS_TOKEN');
  });

  it('fails with a TypeError when the logout command is missing', async () => {
    h.state.commands.splice(1, 1);
    answer('1. Authentication (Login/Logout)', '2. Logout');
    await expect(runCommandsInteractivelyInner()).rejects.toBeInstanceOf(TypeError);
    expect(runCommand).not.toHaveBeenCalled();
  });
});

describe('runCommandsInteractivelyInner - direct command mode', () => {
  it('runs a known command given as the only argument', async () => {
    process.argv = ['node', 'appcircle', 'build'];
    await expect(runCommandsInteractivelyInner()).resolves.toBeUndefined();
    expect(runCommand).toHaveBeenCalledWith({ fullCommandName: 'build' });
    expect(h.state.prompts).toEqual([]);
  });

  it('exits with code 0 when the user leaves the top-level sub-menu', async () => {
    process.argv = ['node', 'appcircle', 'menu'];
    answer((cfg: any) => {
      expect(cfg.choices.at(-1)).toEqual({ name: 'back', message: '⬅ Exit' });
      return 'back';
    });
    await expect(runCommandsInteractivelyInner()).resolves.toBeUndefined();
    expect(console.log).toHaveBeenCalledWith('Goodbye! 👋');
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('does nothing when the command parameters halt', async () => {
    process.argv = ['node', 'appcircle', 'halt'];
    await expect(runCommandsInteractivelyInner()).resolves.toBeUndefined();
    expect(runCommand).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe('runCommandsInteractively', () => {
  it('exits with code 0 when the user exits from the main menu', async () => {
    answer('0. Exit');
    await runCommandsInteractively();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('prints the error and exits with its code outside interactive mode', async () => {
    vi.mocked(runCommand).mockRejectedValueOnce(new AppcircleExitError('bad things', 3));
    answer('2. Build');
    await runCommandsInteractively();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('bad things (exit code: 3)'));
    expect(exitSpy).toHaveBeenCalledWith(3);
  });

  it('restarts the menu after a failure in interactive mode', async () => {
    process.argv = ['node', 'appcircle', '-i'];
    vi.mocked(runCommand).mockRejectedValueOnce(new AppcircleExitError('bad things', 3));
    answer('2. Build', '0. Exit');
    await runCommandsInteractively();
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(h.state.prompts).toHaveLength(2);
  });

  it('rethrows unexpected errors', async () => {
    const boom = new Error('unexpected');
    vi.mocked(runCommand).mockRejectedValueOnce(boom);
    answer('2. Build');
    await expect(runCommandsInteractively()).rejects.toBe(boom);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe('handleAuthenticationSubMenu - stored token', () => {
  const selector = (selection: string) => vi.fn(() => ({ run: vi.fn().mockResolvedValue(selection) }));
  const findCommand = vi.fn((cmd: string) => ({ command: cmd }));

  it('refuses to log in again while the token is valid', async () => {
    vi.mocked(validateCurrentTokenIsValid).mockResolvedValue(true);
    const result = await handleAuthenticationSubMenu(selector('1. Login'), () => 'token', findCommand);
    expect(result).toEqual({ shouldShowMainMenuAgain: true });
    expect(console.error).toHaveBeenCalledWith('You are already logged in. Use "Logout" to logout first.');
    expect(clearStoredToken).not.toHaveBeenCalled();
  });

  it('clears an expired token and continues with login', async () => {
    vi.mocked(validateCurrentTokenIsValid).mockResolvedValue(false);
    const result = await handleAuthenticationSubMenu(selector('1. Login'), () => 'token', findCommand);
    expect(result).toEqual({ selectedCommand: { command: 'login' } });
    expect(clearStoredToken).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(
      'Current token is expired or invalid. Clearing stored token and proceeding with new login...'
    );
  });

  it('assumes the user is logged in when validation fails', async () => {
    vi.mocked(validateCurrentTokenIsValid).mockRejectedValue(new Error('offline'));
    const result = await handleAuthenticationSubMenu(selector('1. Login'), () => 'token', findCommand);
    expect(result).toEqual({ shouldShowMainMenuAgain: true });
    expect(console.error).toHaveBeenCalledWith('You are already logged in. Use "Logout" to logout first.');
  });

  it('looks commands up in Commands by default', async () => {
    const result = await handleAuthenticationSubMenu(selector('2. Logout'), () => '');
    expect(result.selectedCommand).toBe(h.state.commands[1]);
  });
});

describe('handleSelectedCommand navigation', () => {
  const tree = () =>
    leaf('root', 'Root', {
      subCommands: [
        leaf('mid', 'Mid', {
          subCommands: [leaf('deep', 'Deep', { subCommands: [leaf('x', 'X'), leaf('y', 'Y')] }), leaf('other', 'Other')],
        }),
        leaf('sibling', 'Sibling'),
        leaf('hidden', 'Hidden', { hidden: true }),
      ],
    });

  beforeEach(async () => {
    // Earlier main-menu runs leave entries on the module's navigation stack; pop them all.
    const reopen = vi.fn(async () => undefined);
    while (!((await handleBackNavigation(reopen)) as any)?.isBackToMainMenu) {
      // keep popping
    }
  });

  it('walks forward and back through nested menus until it returns to the main menu', async () => {
    answer('1. Mid', '1. Deep', 'back', (cfg: any) => {
      // Back on "Deep" re-opens "Mid".
      expect(cfg.message).toBe('Which sub-command of "Mid" do you want to run?');
      return 'back';
    });
    const result = await handleSelectedCommand(tree() as any, {});
    expect(result).toEqual({ isBackToMainMenu: true });
    expect(h.state.prompts.map((p) => p.choices.length)).toEqual([2, 3, 3, 3]);
  });

  it('returns undefined for a selection that is not in the list', async () => {
    answer('9. Missing');
    expect(await handleSelectedCommand(tree() as any, {})).toBeUndefined();
  });
});

describe('small menu helpers', () => {
  it('checkUserAuthenticationStatus reflects the stored token', () => {
    vi.mocked(readEnviromentConfigVariable).mockReturnValue('abc');
    expect(checkUserAuthenticationStatus()).toBe(true);
    vi.mocked(readEnviromentConfigVariable).mockReturnValue('');
    expect(checkUserAuthenticationStatus()).toBe(false);
  });

  it('adjustCommandIndexForAuthGrouping skips the grouped logout entry', () => {
    const commands = [{ command: 'login' }, { command: 'logout' }, { command: 'build' }, { command: 'config' }];
    expect(adjustCommandIndexForAuthGrouping(0, commands)).toBe(0);
    expect(adjustCommandIndexForAuthGrouping(1, commands)).toBe(2);
    expect(adjustCommandIndexForAuthGrouping(2, commands)).toBe(3);
    expect(adjustCommandIndexForAuthGrouping(7, commands)).toBe(7);
  });
});
