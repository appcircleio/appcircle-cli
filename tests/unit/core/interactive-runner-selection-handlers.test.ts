/**
 * @fileoverview Edge cases of the injectable selection handlers in interactive-runner
 * (spinner helper, id extraction, variable groups, certificates, publish profiles/flows/app versions).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('ora', () => ({
  default: vi.fn((text: string) => {
    const spinner: any = { text };
    spinner.start = vi.fn(() => spinner);
    spinner.stop = vi.fn(() => spinner);
    spinner.fail = vi.fn(() => spinner);
    spinner.succeed = vi.fn(() => spinner);
    return spinner;
  }),
}));

vi.mock('../../../src/services', () => ({}));
vi.mock('../../../src/program', () => ({ createCommandActionCallback: vi.fn() }));
vi.mock('../../../src/core/command-runner', () => ({ runCommand: vi.fn() }));

import ora from 'ora';
import {
  createSpinnerWithErrorHandling,
  extractUuidFromText,
  processSelectedItemId,
  handleBranchIdParameter,
  handleCommitIdParameter,
  handleOrganizationIdParameter,
  handleVariableGroupIdParameter,
  handleCertificateIdParameter,
  handlePublishProfileIdParameter,
  handlePublishFlowIdParameter,
  handleAppVersionIdParameter,
} from '../../../src/core/interactive-runner';

const U1 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const makeSpinner = () => {
  const spinner: any = { text: '' };
  spinner.start = vi.fn(() => spinner);
  spinner.stop = vi.fn(() => spinner);
  spinner.fail = vi.fn(() => spinner);
  return spinner;
};

/** Returns a fake ora factory plus the spinner it hands out. */
const fakeOra = () => {
  const spinner = makeSpinner();
  const factory = vi.fn(() => spinner);
  return { spinner, factory: factory as any };
};

/** Returns a fake prompt factory that answers with `selection`. */
const fakePrompt = (selection: string) => {
  const factory = vi.fn((_name: string, _message: string, _choices: string[], _limit?: number) => ({
    run: vi.fn().mockResolvedValue(selection),
  }));
  return factory as any;
};

describe('createSpinnerWithErrorHandling', () => {
  it('starts the spinner and exposes fail/stop helpers', () => {
    const { spinner, factory } = fakeOra();
    const result = createSpinnerWithErrorHandling('Loading...', factory);
    expect(factory).toHaveBeenCalledWith('Loading...');
    expect(spinner.start).toHaveBeenCalled();
    expect(result.spinner).toBe(spinner);

    result.failWithMessage('Broken');
    expect(spinner.text).toBe('Broken');
    expect(spinner.fail).toHaveBeenCalled();

    result.stopSpinner();
    expect(spinner.stop).toHaveBeenCalled();
  });

  it('uses ora by default', () => {
    const result = createSpinnerWithErrorHandling('Default spinner');
    expect(ora).toHaveBeenCalledWith('Default spinner');
    expect(result.spinner.start).toHaveBeenCalled();
  });
});

describe('extractUuidFromText / processSelectedItemId', () => {
  it('extracts a UUID only when it is in parentheses', () => {
    expect(extractUuidFromText(`Name (${U1})`)).toBe(U1);
    expect(extractUuidFromText(`Name ${U1}`)).toBeNull();
    expect(extractUuidFromText('Name (short-id)')).toBeNull();
  });

  it('prefers a UUID, then an item match, then the extracted id', () => {
    const items = [
      { id: 'one', name: 'First' },
      { id: 'two', name: 'Second' },
    ];
    expect(processSelectedItemId(`Anything (${U1})`, items)).toBe(U1);
    expect(processSelectedItemId('two - Second', items)).toBe('two');
    expect(processSelectedItemId('unknown - Thing', items)).toBe('unknown');
  });

  it('matches by raw selection or "name (id)" with a custom id field', () => {
    const items = [
      { key: 'k0', name: 'Zero' },
      { key: 'k1: x', name: 'One' },
    ];
    // extractIdFromSelection("k1: x") yields "k1", so only the raw comparison finds the item.
    expect(processSelectedItemId('k1: x', items, 'key')).toBe('k1: x');
    expect(processSelectedItemId('none', items, 'key')).toBe('none');
  });
});

describe('cached list lookups that find nothing', () => {
  it('handleBranchIdParameter keeps profile and branch ids that are not cached', async () => {
    const { factory } = fakeOra();
    const params: any = { profileId: 'Prof (p9)', branchId: 'Main (b9)' };
    const getBranches = vi.fn().mockResolvedValue({ branches: [{ id: 'b1', name: 'main' }] });
    const result = await handleBranchIdParameter(
      { name: 'branchId' },
      params,
      [{ id: 'p1' }],
      [{ id: 'b1' }],
      getBranches,
      fakePrompt('b1 - main'),
      factory
    );
    expect(params).toEqual({ profileId: 'Prof (p9)', branchId: 'Main (b9)' });
    expect(getBranches).toHaveBeenCalledWith({ profileId: 'Prof (p9)' });
    expect(result).toEqual({ value: 'b1' });
  });

  it('handleCommitIdParameter keeps branch and commit ids that are not cached', async () => {
    const { factory } = fakeOra();
    const params: any = { branchId: 'Main (b9)', commitId: 'Msg (c9)' };
    const getCommits = vi.fn().mockResolvedValue([{ id: U1, message: 'm' }]);
    const result = await handleCommitIdParameter(
      { name: 'commitId' },
      params,
      [{ id: 'b1' }],
      [{ id: 'c1' }],
      getCommits,
      fakePrompt(`"m" (${U1}) (latest)`),
      factory
    );
    expect(getCommits).toHaveBeenCalledWith({ profileId: '', branchId: 'Main (b9)' });
    expect(params.commitId).toBe('Msg (c9)');
    expect(result).toEqual({ value: U1 });
  });
});

describe('handleOrganizationIdParameter', () => {
  it('labels organizations without a name or id', async () => {
    const { factory } = fakeOra();
    const createPrompt = fakePrompt('all');
    const result = await handleOrganizationIdParameter(
      { name: 'organizationId', defaultValue: 'all' },
      {},
      vi.fn().mockResolvedValue({ currentOrganizationId: 'o1' }),
      vi.fn().mockResolvedValue([{ id: 'o1', name: '  Root  ' }, {}]),
      createPrompt,
      factory
    );
    expect(result).toEqual({ value: 'all' });
    expect(createPrompt.mock.calls[0][2]).toEqual(['all', 'Root (o1)', 'Unknown (undefined)']);
  });
});

describe('handleVariableGroupIdParameter', () => {
  const groups = [
    { id: 'g0', name: 'Zero' },
    { id: 'g1', name: 'One' },
  ];

  it('fails when no groups exist', async () => {
    const { spinner, factory } = fakeOra();
    const result = await handleVariableGroupIdParameter({ name: 'v' }, {}, vi.fn().mockResolvedValue(null), fakePrompt('x'), factory);
    expect(result).toEqual({ isError: true });
    expect(spinner.text).toBe('No Environment Variable Groups Available');
    expect(spinner.fail).toHaveBeenCalled();
  });

  it('extracts the id from the label', async () => {
    const { factory } = fakeOra();
    const createPrompt = fakePrompt('One (g1)');
    const result = await handleVariableGroupIdParameter({ name: 'v', description: 'Group' }, {}, vi.fn().mockResolvedValue(groups), createPrompt, factory);
    expect(result).toEqual({ value: 'g1' });
    expect(createPrompt).toHaveBeenCalledWith('v', 'Group (2 options)', ['Zero (g0)', 'One (g1)'], 10);
  });

  it('falls back to an id lookup and finally to the raw selection', async () => {
    const { factory } = fakeOra();
    expect(await handleVariableGroupIdParameter({ name: 'v' }, {}, vi.fn().mockResolvedValue(groups), fakePrompt('g1'), factory)).toEqual({
      value: 'g1',
    });
    const createPrompt = fakePrompt('nope');
    expect(await handleVariableGroupIdParameter({ name: 'v' }, {}, vi.fn().mockResolvedValue(groups), createPrompt, factory)).toEqual({
      value: 'nope',
    });
    expect(createPrompt.mock.calls[0][1]).toBe('Variable Group (2 options)');
  });
});

describe('handleCertificateIdParameter', () => {
  it('fails when fetching certificates throws', async () => {
    const { spinner, factory } = fakeOra();
    const result = await handleCertificateIdParameter(
      { name: 'certificateId' },
      {},
      vi.fn().mockRejectedValue(new Error('down')),
      vi.fn(),
      fakePrompt('x'),
      factory
    );
    expect(result).toEqual({ isError: true });
    expect(spinner.text).toBe('Fetching certificates failed');
  });

  it('fails when both certificate lists are empty', async () => {
    const { spinner, factory } = fakeOra();
    const result = await handleCertificateIdParameter(
      { name: 'certificateId' },
      {},
      vi.fn().mockResolvedValue(null),
      vi.fn().mockResolvedValue(undefined),
      fakePrompt('x'),
      factory
    );
    expect(result).toEqual({ isError: true });
    expect(spinner.text).toBe('No certificate available');
  });

  it('formats P12, CSR and other certificates', async () => {
    const { factory } = fakeOra();
    const param: any = { name: 'certificateId' };
    const createPrompt = fakePrompt('Plain (c3)');
    const result = await handleCertificateIdParameter(
      param,
      {},
      vi.fn().mockResolvedValue([
        { id: 'c0', name: 'Dist', teamId: 'T1', appleTeamId: 'A1', extension: 'P12' },
        { id: 'c1', extension: 'P12' },
      ]),
      vi.fn().mockResolvedValue([
        { id: 'c2', extension: 'CSR' },
        { id: 'c3', name: 'Plain', extension: 'CER' },
        { id: 'c4' },
      ]),
      createPrompt,
      factory
    );
    expect(result).toEqual({ value: 'c3' });
    expect(param.params.map((p: any) => p.name)).toEqual([
      'Dist: T1 (A1) (c0)',
      'Unknown (c1)',
      'csr: Unknown -  (c2)',
      'Plain (c3)',
      'Unknown (c4)',
    ]);
    expect(createPrompt.mock.calls[0][1]).toBe('Certificate (5 options)');
  });

  it('falls back to an id search and then to the raw selection', async () => {
    const { factory } = fakeOra();
    const p12 = vi.fn().mockResolvedValue([{ id: 'c0', name: 'Dist', extension: 'P12' }]);
    const csr = vi.fn().mockResolvedValue([]);
    expect(await handleCertificateIdParameter({ name: 'c' }, {}, p12, csr, fakePrompt('pick c0 please'), factory)).toEqual({ value: 'c0' });
    expect(await handleCertificateIdParameter({ name: 'c' }, {}, p12, csr, fakePrompt('nothing'), factory)).toEqual({ value: 'nothing' });
  });
});

describe('handlePublishProfileIdParameter', () => {
  it('formats profiles defensively and works without param/params objects', async () => {
    const { factory } = fakeOra();
    const createPrompt = fakePrompt('Unknown () - Unknown Platform');
    const getPublishProfiles = vi.fn().mockResolvedValue([{ platformType: 7 }]);
    const result = await handlePublishProfileIdParameter(null, null, getPublishProfiles, createPrompt, factory);
    expect(getPublishProfiles).toHaveBeenCalledWith({ platform: undefined });
    expect(createPrompt).toHaveBeenCalledWith('publishProfileId', 'Publish Profile (1 options)', ['Unknown () - Unknown Platform'], 10);
    expect(result).toEqual({ value: 'Unknown () - Unknown Platform' });
  });

  it('extracts the id and stores the choices on param and params', async () => {
    const { factory } = fakeOra();
    const param: any = { name: 'publishProfileId', description: 'Profile' };
    const params: any = { platform: 'android' };
    const getPublishProfiles = vi.fn().mockResolvedValue([{ id: 'pp1', name: 'Store', platformType: 2 }]);
    const result = await handlePublishProfileIdParameter(param, params, getPublishProfiles, fakePrompt('Store (pp1) - Android'), factory);
    expect(result).toEqual({ value: 'pp1' });
    expect(getPublishProfiles).toHaveBeenCalledWith({ platform: 'android' });
    expect(param.params).toEqual([{ name: 'Store (pp1) - Android', message: 'Store (pp1) - Android', _id: 'pp1' }]);
    expect(params._publishProfileParams).toBe(param.params);
  });

  it('returns an error when loading fails', async () => {
    const { spinner, factory } = fakeOra();
    const result = await handlePublishProfileIdParameter({}, {}, vi.fn().mockRejectedValue(new Error('x')), fakePrompt(''), factory);
    expect(result).toEqual({ isError: true });
    expect(spinner.fail).toHaveBeenCalledWith('Failed to load publish profiles');
  });
});

describe('handlePublishFlowIdParameter', () => {
  it('formats flows defensively and works without a param object', async () => {
    const { factory } = fakeOra();
    const createPrompt = fakePrompt('Unknown ()');
    const getPublishFlows = vi.fn().mockResolvedValue([{}]);
    const result = await handlePublishFlowIdParameter(null, null, getPublishFlows, createPrompt, factory);
    expect(getPublishFlows).toHaveBeenCalledWith({ platform: undefined, publishProfileId: undefined });
    expect(createPrompt).toHaveBeenCalledWith('publishFlowId', 'Publish Flow (1 options)', ['Unknown ()'], 10);
    expect(result).toEqual({ value: 'Unknown ()' });
  });

  it('returns an error when loading fails', async () => {
    const { spinner, factory } = fakeOra();
    const result = await handlePublishFlowIdParameter({}, {}, vi.fn().mockRejectedValue(new Error('x')), fakePrompt(''), factory);
    expect(result).toEqual({ isError: true });
    expect(spinner.fail).toHaveBeenCalledWith('Failed to load publish flows');
  });
});

describe('handleAppVersionIdParameter', () => {
  it('normalises a "(id)" publish profile, formats versions and works without param', async () => {
    const { factory } = fakeOra();
    const params: any = { platform: 'ios', publishProfileId: 'Store (pp1) - iOS' };
    const createPrompt = fakePrompt('Unknown');
    const getAppVersions = vi.fn().mockResolvedValue([{ releaseCandidate: true }]);
    const result = await handleAppVersionIdParameter(null, params, getAppVersions, createPrompt, factory);
    expect(params.publishProfileId).toBe('pp1');
    expect(getAppVersions).toHaveBeenCalledWith({ platform: 'ios', publishProfileId: 'pp1' });
    expect(createPrompt).toHaveBeenCalledWith(
      'appVersionId',
      'App Version (1 options)',
      [' Unknown(Unknown) -  (Release Candidate)'],
      10
    );
    expect(result).toEqual({ value: 'Unknown' });
  });

  it('extracts a UUID at the start of the selection', async () => {
    const { factory } = fakeOra();
    const param: any = { name: 'appVersionId' };
    const result = await handleAppVersionIdParameter(
      param,
      {},
      vi.fn().mockResolvedValue([{ id: U1, name: 'App', version: '1' }]),
      fakePrompt(`  ${U1} chosen`),
      factory
    );
    expect(result).toEqual({ value: U1 });
    expect(param.params[0]._id).toBe(U1);
  });

  it('maps an exact label to its id and keeps unknown selections', async () => {
    const { factory } = fakeOra();
    const versions = vi.fn().mockResolvedValue([{ id: 'v-1', name: 'App', version: '2' }]);
    expect(await handleAppVersionIdParameter({}, {}, versions, fakePrompt(' App(2) - v-1 '), factory)).toEqual({ value: 'v-1' });
    expect(await handleAppVersionIdParameter({}, {}, versions, fakePrompt('other'), factory)).toEqual({ value: 'other' });
  });

  it('returns an error when loading fails', async () => {
    const { spinner, factory } = fakeOra();
    const result = await handleAppVersionIdParameter({}, {}, vi.fn().mockRejectedValue(new Error('x')), fakePrompt(''), factory);
    expect(result).toEqual({ isError: true });
    expect(spinner.fail).toHaveBeenCalledWith('Failed to load app versions');
  });
});
