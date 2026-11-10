/**
 * handleBuildCommand: build profile / branch / workflow / configuration /
 * commit / build list commands and the workflow download / update / create flows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

const h = vi.hoisted(() => {
  const state = { spinners: [] as any[] };
  const makeSpinner = (initialText: string) => {
    const spinner: any = {
      initialText,
      text: initialText,
      start: vi.fn(() => spinner),
      stop: vi.fn(() => spinner),
      succeed: vi.fn(() => spinner),
      fail: vi.fn(() => spinner),
    };
    state.spinners.push(spinner);
    return spinner;
  };
  return { state, makeSpinner };
});

vi.mock('../../../src/utils/orahelper', () => ({
  createOra: vi.fn((text: string) => h.makeSpinner(text)),
}));

vi.mock('../../../src/core/writer', () => ({
  commandWriter: vi.fn(),
  configWriter: vi.fn(),
}));

vi.mock('../../../src/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services')>();
  return {
    ...actual,
    getBuildProfiles: vi.fn(),
    getBranches: vi.fn(),
    getWorkflows: vi.fn(),
    getConfigurations: vi.fn(),
    getCommits: vi.fn(),
    getBuildsOfCommit: vi.fn(),
    downloadWorkflowYaml: vi.fn(),
    updateWorkflowFromFile: vi.fn(),
    createWorkflowFromFile: vi.fn(),
  };
});

import { handleBuildCommand, getLongDescriptionForCommand } from '../../../src/core/command-runner';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { ProgramError } from '../../../src/core/ProgramError';
import { CommandTypes } from '../../../src/core/commands';
import * as services from '../../../src/services';
import { commandWriter } from '../../../src/core/writer';

const svc = vi.mocked(services);
let errorSpy: ReturnType<typeof vi.spyOn>;

const cmd = (name: string): any => ({ fullCommandName: `appcircle-${name}`, opts: () => ({}) });
const spinner = (initialText: string) => {
  const found = [...h.state.spinners].reverse().find((s) => s.initialText === initialText);
  if (!found) throw new Error(`no spinner created with "${initialText}"`);
  return found;
};

async function expectHelpExit(name: string, params: any) {
  const error: any = await handleBuildCommand(cmd(name), params).catch((e) => e);
  expect(error).toBeInstanceOf(AppcircleExitError);
  expect(error.code).toBe(1);
  const desc = getLongDescriptionForCommand(`appcircle-${name}`);
  expect(desc).toBeTruthy();
  expect(errorSpy).toHaveBeenCalledWith(`\n${desc}\n`);
}

beforeEach(() => {
  h.state.spinners.length = 0;
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true, isFile: () => true, size: 1 } as any);
  svc.getBuildProfiles.mockResolvedValue([{ id: 'p1', name: 'Profile' }]);
  svc.getWorkflows.mockResolvedValue([{ id: 'w1', workflowName: 'Default Flow' }]);
});

describe('build profile list', () => {
  it('writes the build profiles', async () => {
    const params = { all: true };

    await handleBuildCommand(cmd('build-profile-list'), params);

    expect(svc.getBuildProfiles).toHaveBeenCalledWith(params);
    expect(spinner('Listing...').stop).toHaveBeenCalled();
    expect(commandWriter).toHaveBeenCalledWith(CommandTypes.BUILD, {
      fullCommandName: 'appcircle-build-profile-list',
      data: [{ id: 'p1', name: 'Profile' }],
    });
  });
});

describe.each([
  ['build-profile-branch-list', 'getBranches', { branches: [{ id: 'b1', name: 'main' }] }],
  ['build-profile-workflow-list', 'getWorkflows', [{ id: 'w1', workflowName: 'Default Flow' }]],
  ['build-profile-configurations', 'getConfigurations', [{ item1: { id: 'c1', configurationName: 'Release' } }]],
] as const)('%s', (name, serviceName, data) => {
  it('prints the help and exits without a profile', async () => {
    await expectHelpExit(name, {});
    expect((svc as any)[serviceName]).not.toHaveBeenCalled();
  });

  it('resolves a profile name and writes the result', async () => {
    (svc as any)[serviceName].mockResolvedValue(data);
    const params: any = { profile: 'Profile' };

    await handleBuildCommand(cmd(name), params);

    expect(params.profileId).toBe('p1');
    expect((svc as any)[serviceName]).toHaveBeenCalledWith(params);
    expect(commandWriter).toHaveBeenCalledWith(CommandTypes.BUILD, { fullCommandName: `appcircle-${name}`, data });
  });
});

describe('build profile workflows (deprecated alias)', () => {
  it('prints the help and exits without a profile', async () => {
    await expectHelpExit('build-profile-workflows', {});
  });

  it('warns about the deprecation and still lists the workflows', async () => {
    await handleBuildCommand(cmd('build-profile-workflows'), { profileId: 'p1' });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('"appcircle build profile workflows" is deprecated'));
    expect(commandWriter).toHaveBeenCalledWith(CommandTypes.BUILD, {
      fullCommandName: 'appcircle-build-profile-workflows',
      data: [{ id: 'w1', workflowName: 'Default Flow' }],
    });
  });
});

describe('build profile branch commits', () => {
  it('prints the help and exits without a profile', async () => {
    await expectHelpExit('build-profile-branch-commits', { branchId: 'b1' });
  });

  it('prints the help and exits without a branch', async () => {
    await expectHelpExit('build-profile-branch-commits', { profileId: 'p1' });
    expect(svc.getCommits).not.toHaveBeenCalled();
  });

  it('writes the commits of the branch', async () => {
    svc.getCommits.mockResolvedValue([{ id: 'c1' }]);

    await handleBuildCommand(cmd('build-profile-branch-commits'), { profileId: 'p1', branchId: 'b1' });

    expect(svc.getCommits).toHaveBeenCalledWith({ profileId: 'p1', branchId: 'b1' });
    expect(commandWriter).toHaveBeenCalledWith(CommandTypes.BUILD, {
      fullCommandName: 'appcircle-build-profile-branch-commits',
      data: [{ id: 'c1' }],
    });
  });
});

describe('build list', () => {
  it('prints the help and exits without a profile', async () => {
    await expectHelpExit('build-list', { branchId: 'b1', commitId: 'c1' });
  });

  it('prints the help and exits without a branch', async () => {
    await expectHelpExit('build-list', { profileId: 'p1', commitId: 'c1' });
  });

  it('prints the help and exits without a commit', async () => {
    await expectHelpExit('build-list', { profileId: 'p1', branchId: 'b1' });
    expect(svc.getBuildsOfCommit).not.toHaveBeenCalled();
  });

  it('writes the builds of the commit', async () => {
    svc.getBuildsOfCommit.mockResolvedValue({ builds: [{ id: 'build-1' }] });

    await handleBuildCommand(cmd('build-list'), { profileId: 'p1', branchId: 'b1', commitId: 'c1' });

    expect(svc.getBuildsOfCommit).toHaveBeenCalledWith({ profileId: 'p1', branchId: 'b1', commitId: 'c1' });
    expect(commandWriter).toHaveBeenCalledWith(CommandTypes.BUILD, {
      fullCommandName: 'appcircle-build-list',
      data: { builds: [{ id: 'build-1' }] },
    });
  });
});

describe('build profile workflow download', () => {
  beforeEach(() => {
    svc.downloadWorkflowYaml.mockResolvedValue('steps: []' as any);
  });

  it('prints the help and exits without a profile', async () => {
    await expectHelpExit('build-profile-workflow-download', { workflowId: 'w1' });
  });

  it('prints the help and exits without a workflow', async () => {
    await expectHelpExit('build-profile-workflow-download', { profileId: 'p1' });
    expect(svc.downloadWorkflowYaml).not.toHaveBeenCalled();
  });

  it('names the file after the workflow and creates a missing directory', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const params = { profileId: 'p1', workflowId: 'w1', path: '~/flows' };

    await handleBuildCommand(cmd('build-profile-workflow-download'), params);

    expect(svc.getWorkflows).toHaveBeenCalledWith({ profileId: 'p1' });
    expect(svc.downloadWorkflowYaml).toHaveBeenCalledWith(params);
    const dir = '/mock/resolved//mock/home/user/flows';
    expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
    const [filePath, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(filePath).toMatch(new RegExp(`^${dir}/Default Flow_\\d+\\.yaml$`));
    expect(Buffer.isBuffer(content)).toBe(true);
    expect(String(content)).toBe('steps: []');
    expect(spinner('Downloading Workflow...').succeed).toHaveBeenCalledWith(`Workflow downloaded successfully to ${filePath}`);
  });

  it('keeps the workflow id as the name when the lookup fails and writes to an existing file path', async () => {
    svc.getWorkflows.mockRejectedValue(new Error('lookup failed'));
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);

    await handleBuildCommand(cmd('build-profile-workflow-download'), {
      profileId: 'p1',
      workflowId: 'w1',
      path: '/tmp/flow.yaml',
    });

    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith('/mock/resolved//tmp/flow.yaml', expect.any(Buffer));
    expect(spinner('Downloading Workflow...').succeed).toHaveBeenCalledWith(
      'Workflow downloaded successfully to /mock/resolved//tmp/flow.yaml'
    );
  });

  it.each([
    ['no workflows are returned', null],
    ['the workflow has no name', [{ id: 'w1' }]],
    ['the workflow is not listed', [{ id: 'other', workflowName: 'Other' }]],
  ])('falls back to the workflow id when %s', async (_label, workflows) => {
    svc.getWorkflows.mockResolvedValue(workflows as any);

    await handleBuildCommand(cmd('build-profile-workflow-download'), { profileId: 'p1', workflowId: 'w1' });

    const [filePath] = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(filePath).toMatch(/^\/mock\/resolved\/\/mock\/home\/user\/Downloads\/w1_\d+\.yaml$/);
  });

  it('fails the spinner and rethrows when the download fails', async () => {
    const failure = new Error('download failed');
    svc.downloadWorkflowYaml.mockRejectedValue(failure);

    await expect(
      handleBuildCommand(cmd('build-profile-workflow-download'), { profileId: 'p1', workflowId: 'w1' })
    ).rejects.toBe(failure);

    expect(spinner('Downloading Workflow...').fail).toHaveBeenCalledWith('Failed to download Workflow');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});

describe('build profile workflow update', () => {
  it.each([
    ['a profile', { workflowId: 'w1', filePath: '/f.yaml' }],
    ['a workflow', { profileId: 'p1', filePath: '/f.yaml' }],
    ['a file path', { profileId: 'p1', workflowId: 'w1' }],
  ])('prints the help and exits without %s', async (_label, params) => {
    await expectHelpExit('build-profile-workflow-update', params);
    expect(svc.updateWorkflowFromFile).not.toHaveBeenCalled();
  });

  it('expands the home directory and updates the workflow', async () => {
    svc.updateWorkflowFromFile.mockResolvedValue(undefined as any);
    const params: any = { profileId: 'p1', workflowId: 'w1', filePath: '~/flow.yaml' };

    await handleBuildCommand(cmd('build-profile-workflow-update'), params);

    expect(params.filePath).toBe('/mock/resolved//mock/home/user/flow.yaml');
    expect(svc.updateWorkflowFromFile).toHaveBeenCalledWith(params);
    expect(spinner('Updating Workflow...').succeed).toHaveBeenCalledWith('Workflow updated successfully');
  });

  it('rejects a path that does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const error = await handleBuildCommand(cmd('build-profile-workflow-update'), {
      profileId: 'p1',
      workflowId: 'w1',
      filePath: '/missing.yaml',
    }).catch((e) => e);

    expect(error).toBeInstanceOf(ProgramError);
    expect(error.message).toBe('Workflow file not found at path: /mock/resolved//missing.yaml');
  });

  it('rejects a path that is not a file', async () => {
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => false } as any);

    await expect(
      handleBuildCommand(cmd('build-profile-workflow-update'), { profileId: 'p1', workflowId: 'w1', filePath: '/dir' })
    ).rejects.toThrow('Workflow file not found at path: /mock/resolved//dir');
    expect(h.state.spinners).toHaveLength(0);
  });

  it('fails the spinner and rethrows when the update fails', async () => {
    const failure = new Error('update failed');
    svc.updateWorkflowFromFile.mockRejectedValue(failure);

    await expect(
      handleBuildCommand(cmd('build-profile-workflow-update'), { profileId: 'p1', workflowId: 'w1', filePath: '/f.yaml' })
    ).rejects.toBe(failure);
    expect(spinner('Updating Workflow...').fail).toHaveBeenCalledWith('Failed to update Workflow');
  });
});

describe('build profile workflow create', () => {
  it.each([
    ['a profile', { workflowName: 'New', filePath: '/f.yaml' }],
    ['a workflow name', { profileId: 'p1', filePath: '/f.yaml' }],
    ['a file path', { profileId: 'p1', workflowName: 'New' }],
  ])('prints the help and exits without %s', async (_label, params) => {
    await expectHelpExit('build-profile-workflow-create', params);
    expect(svc.createWorkflowFromFile).not.toHaveBeenCalled();
  });

  it('reports the created workflow name and id', async () => {
    svc.createWorkflowFromFile.mockResolvedValue({ workflowName: 'Server Name', id: 'w9' } as any);
    const params: any = { profileId: 'p1', workflowName: 'New', filePath: '~/flow.yaml' };

    await handleBuildCommand(cmd('build-profile-workflow-create'), params);

    expect(params.filePath).toBe('/mock/resolved//mock/home/user/flow.yaml');
    expect(svc.createWorkflowFromFile).toHaveBeenCalledWith(params);
    expect(spinner('Creating Workflow...').succeed).toHaveBeenCalledWith("Workflow 'Server Name' (w9) created successfully");
  });

  it('falls back to the requested name when the response is empty', async () => {
    svc.createWorkflowFromFile.mockResolvedValue(undefined as any);

    await handleBuildCommand(cmd('build-profile-workflow-create'), {
      profileId: 'p1',
      workflowName: 'New',
      filePath: '/f.yaml',
    });

    expect(spinner('Creating Workflow...').succeed).toHaveBeenCalledWith("Workflow 'New' created successfully");
  });

  it('rejects a missing file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await expect(
      handleBuildCommand(cmd('build-profile-workflow-create'), { profileId: 'p1', workflowName: 'New', filePath: '/x.yaml' })
    ).rejects.toThrow('Workflow file not found at path: /mock/resolved//x.yaml');
  });

  it('rejects a path that is not a file', async () => {
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => false } as any);

    await expect(
      handleBuildCommand(cmd('build-profile-workflow-create'), { profileId: 'p1', workflowName: 'New', filePath: '/dir' })
    ).rejects.toBeInstanceOf(ProgramError);
  });

  it('fails the spinner and rethrows when the creation fails', async () => {
    const failure = new Error('create failed');
    svc.createWorkflowFromFile.mockRejectedValue(failure);

    await expect(
      handleBuildCommand(cmd('build-profile-workflow-create'), { profileId: 'p1', workflowName: 'New', filePath: '/f.yaml' })
    ).rejects.toBe(failure);
    expect(spinner('Creating Workflow...').fail).toHaveBeenCalledWith('Failed to create Workflow');
  });
});
