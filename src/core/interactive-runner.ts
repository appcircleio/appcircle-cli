import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import moment from 'moment';
//@ts-ignore https://github.com/enquirer/enquirer/issues/212
import { prompt, Select, AutoComplete, BooleanPrompt } from 'enquirer';
import { runCommand } from './command-runner';
import { Commands, CommandParameterTypes, CommandType } from './commands';
import { APPCIRCLE_COLOR, OperatingSystems, UNKNOWN_PARAM_VALUE } from '../constant';
import {
  getBranches,
  getEnterpriseProfiles,
  getEnterpriseAppVersions,
  getWorkflows,
  getBuildProfiles,
  getCommits,
  getBuildsOfCommit,
  getDistributionProfiles,
  getEnvironmentVariableGroups,
  getConfigurations,
  getOrganizations,
  getUserInfo,
  getRoleList,
  getOrganizationInvitations,
  getOrganizationUsers,
  getOrganizationUserinfo,
  getPublishProfiles,
  getAppVersions,
  getPublishVariableGroups,
  getCountries,
  getiOSP12Certificates,
  getiOSCSRCertificates,
  getAndroidKeystores,
  getProvisioningProfiles,
  getTestingGroups,
  getDistributionProfileById,
  getTestingGroupById,
  RoleType,
} from '../services';
import { ProgramCommand, createCommandActionCallback } from '../program';
import path from 'path';
import os from 'os';
import minimist from 'minimist';
import { AppcircleExitError } from './AppcircleExitError';

interface NavigationState {
  command: CommandType;
  preparedCommand?: ProgramCommand;
}

const navigationStack: NavigationState[] = [];
let hasShownLogo = false;

const previousSelections = new Map<string, number>();

const expandTilde = (filePath: string): string => {
  if (!filePath) return filePath;
  const expandedPath = filePath.replace(/^~/, os.homedir());
  return path.resolve(expandedPath);
};

const handleInteractiveParamsOrArguments = async (
  commandParams: CommandType['params'] | CommandType['arguments'] = []
): Promise<Record<string, any> | undefined> => {
  let params: any = {};
  const buildProfilesList: any[] = [];
  const branchesList: any[] = [];
  const commitsList: any[] = [];
  const configurationsList: any[] = [];
  for (let param of commandParams) {
    if (param.name === 'branchId') {
      const spinner = ora('Listing Branches...').start();
      if (params.profileId && buildProfilesList.length > 0) {
        const match = /\(([^)]+)\)$/.exec(params.profileId);
        const selectedProfileId = match ? match[1] : params.profileId;
        const selectedProfile = buildProfilesList.find((p) => p.id === selectedProfileId);
        if (selectedProfile) {
          params.profileId = selectedProfile.id;
        }
      }
      if (params.branchId && branchesList.length > 0) {
        const match = /\(([^)]+)\)$/.exec(params.branchId);
        const selectedBranchId = match ? match[1] : params.branchId;
        const selectedBranch = branchesList.find((b) => b.id === selectedBranchId);
        if (selectedBranch) {
          params.branchId = selectedBranch.id;
        }
      }
      const branches = (await getBranches({ profileId: params.profileId || '' })).branches;
      if (!branches || branches.length === 0) {
        spinner.text = 'No branches available';
        spinner.fail();
        return;
      }
      branchesList.length = 0;
      branchesList.push(...branches);
      //@ts-ignore
      param.params = branches.map((branch: any) => ({ name: `${branch.name} (${branch.id})`, message: `${branch.name} (${branch.id})` }));
      spinner.stop();
      // Prompt for selection and always extract UUID
      const selectPrompt = new AutoComplete({
        name: param.name,
        message: param.description || 'Branch',
        initial: param.defaultValue,
        limit: 10,
        choices: Array.isArray(param.params) ? param.params : [],
      });
      const selected = await selectPrompt.run();
      const match = /\(([^)]+)\)$/.exec(selected);
      if (match && match[1]) {
        params.branchId = match[1].trim();
      } else {
        // fallback: try to find by name
        const found = branches.find((b: any) => `${b.name} (${b.id})` === selected || b.id === selected);
        params.branchId = found ? found.id : selected;
      }
      continue;
    } else if (param.name === 'profileId') {
      const spinner = ora('Listing Build Profiles...').start();
      const profiles = await getBuildProfiles();
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No build profile available';
        spinner.fail();
        return;
      }
      buildProfilesList.length = 0;
      buildProfilesList.push(...profiles);
      //@ts-ignore
      param.params = profiles.map((profile: any) => ({ name: `${profile.name} (${profile.id})`, message: `${profile.name} (${profile.id})` }));
      spinner.stop();
      const selectPrompt = new AutoComplete({
        name: param.name,
        message: param.description || 'Build Profile',
        initial: param.defaultValue,
        limit: 10,
        choices: Array.isArray(param.params) ? param.params : [],
      });
      const selected = await selectPrompt.run();
      const match = /\(([^)]+)\)$/.exec(selected);
      if (match && match[1]) {
        params.profileId = match[1].trim();
      } else {
        // fallback: try to find by name
        const found = profiles.find((p: any) => `${p.name} (${p.id})` === selected || p.id === selected);
        params.profileId = found ? found.id : selected;
      }
      continue;
    } else if (param.name === 'commitId') {
      const spinner = ora('Listing Commits...').start();
      if (params.branchId && branchesList.length > 0) {
        const match = /\(([^)]+)\)$/.exec(params.branchId);
        const selectedBranchId = match ? match[1] : params.branchId;
        const selectedBranch = branchesList.find((b) => b.id === selectedBranchId);
        if (selectedBranch) {
          params.branchId = selectedBranch.id;
        }
      }
      if (params.commitId && commitsList.length > 0) {
        const match = /\(([^)]+)\)$/.exec(params.commitId);
        const selectedCommitId = match ? match[1] : params.commitId;
        const selectedCommit = commitsList.find((c) => c.id === selectedCommitId);
        if (selectedCommit) {
          params.commitId = selectedCommit.id;
        }
      }
      const commits = await getCommits({ profileId: params.profileId || '', branchId: params.branchId || '' });
      if (!commits || commits.length === 0) {
        spinner.text = 'No commits available';
        spinner.fail();
        return;
      }
      commitsList.length = 0;
      commitsList.push(...commits);
      //@ts-ignore
      param.params = commits.map((commit: any) => {
        let shortMsg = commit.message && commit.message.trim().length > 0
          ? commit.message.substring(0, 20) + (commit.message.length > 20 ? '...' : '')
          : '<no message>';
        shortMsg = JSON.stringify(shortMsg);
        return { name: `${shortMsg} (${commit.id})`, message: `${shortMsg} (${commit.id})` };
      });
      spinner.stop();
      if (params.commitId) {
        const match = /\(([^)]+)\)$/.exec(params.commitId);
        if (match && match[1]) {
          params.commitId = match[1];
        }
      }
    } else if (param.name === 'buildId') {
      const spinner = ora('Listing Builds...').start();
      let commitId = params.commitId;
      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      if (!uuidRegex.test(commitId)) {
        const match = /\(([^)]+)\)$/.exec(commitId);
        if (match && match[1]) {
          commitId = match[1];
        }
      }
      let buildsResponse, builds;
      try {
        buildsResponse = await getBuildsOfCommit({ commitId });
        builds = buildsResponse.builds;
      } catch (err) {
        spinner.stop();
        // Suppress all further error output
        return;
      }
      if (!builds || builds.length === 0) {
        spinner.stop();
        // Suppress all further error output
        return;
      }
      spinner.stop();
      //@ts-ignore
      param.params = builds.map((build: any) => {
        const dateStr = build.startDate ? moment(build.startDate).format('YYYY-MM-DD HH:mm') : '-';
        return { name: `${build.id} (${dateStr})`, message: `${build.id} (${dateStr})` };
      });
      const selectPrompt = new AutoComplete({
        name: param.name,
        message: param.description || 'Build ID',
        initial: param.defaultValue,
        limit: 10,
        choices: Array.isArray(param.params) ? param.params : [],
      });
      const selected = await selectPrompt.run();
      const match = /^([0-9a-fA-F-]{36})/.exec(selected);
      if (match && match[1]) {
        params.buildId = match[1].trim();
      } else {
        params.buildId = selected;
      }
      continue;
    } else if (param.name === 'entProfileId') {
      const spinner = ora('Listing Enterprise Profiles...').start();
      const profiles = await getEnterpriseProfiles();
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No enterprise profile available';
        spinner.fail();
        return;
      }
      // Use Name (ID) format for both name and message
      param.params = profiles.map((profile: any) => ({ name: `${profile.name} (${profile.id})`, message: `${profile.name} (${profile.id})` }));
      spinner.stop();
      // Prompt for selection and always extract UUID
      const selectPrompt = new AutoComplete({
        name: param.name,
        message: param.description || 'Enterprise Profile',
        initial: param.defaultValue,
        limit: 10,
        choices: Array.isArray(param.params) ? param.params : [],
      });
      const selected = await selectPrompt.run();
      const match = /\(([^)]+)\)$/.exec(selected);
      if (match && match[1]) {
        params.entProfileId = match[1].trim();
      } else {
        // fallback: try to find by name
        const found = profiles.find((p: any) => `${p.name} (${p.id})` === selected || p.id === selected);
        params.entProfileId = found ? found.id : selected;
      }
      continue;
    } else if (param.name === 'distProfileId') {
      const spinner = ora('Listing Distribution Profiles...').start();
      const profiles = await getDistributionProfiles();
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No Distribution Profile Available';
        spinner.fail();
        throw new AppcircleExitError('No Distribution Profile Available', 1);
      }
      //@ts-ignore
      param.params = profiles.map((profile: any) => {
        const display = `${profile.name} (${profile.id})`;
        return { name: display, message: display };
      });
      spinner.stop();
      // Prompt for selection and always extract UUID
      const selectPrompt = new AutoComplete({
        name: param.name,
        message: param.description || 'Distribution Profile',
        initial: param.defaultValue,
        limit: 10,
        choices: Array.isArray(param.params) ? param.params : [],
      });
      const selected = await selectPrompt.run();
      // Extract the UUID from the last parentheses in the new format "Name (UUID)"
      const match = /\(([^)]+)\)\s*$/.exec(selected);
      if (match && match[1]) {
        params.distProfileId = match[1].trim();
      } else {
        // fallback: try to find by id
        const found = profiles.find((profile: any) => selected.includes(profile.id));
        params.distProfileId = found ? found.id : selected;
      }
      continue;
    } else if (param.name === 'variableGroupId') {
      const spinner = ora('Listing Environment Variable Groups...').start();
      const groups = await getEnvironmentVariableGroups();
      if (!groups || groups.length === 0) {
        spinner.text = 'No Environment Variable Groups Available';
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = groups.map((group: any) => ({ name: `${group.name} (${group.id})`, message: `${group.name} (${group.id})` }));
      spinner.stop();
      // Prompt for selection and always extract UUID
      const selectPrompt = new AutoComplete({
        name: param.name,
        message: param.description || 'Variable Group',
        initial: param.defaultValue,
        limit: 10,
        choices: Array.isArray(param.params) ? param.params : [],
      });
      const selected = await selectPrompt.run();
      const match = /\(([^)]+)\)$/.exec(selected);
      if (match && match[1]) {
        params.variableGroupId = match[1].trim();
      } else {
        // fallback: try to find by name
        const found = groups.find((g: any) => `${g.name} (${g.id})` === selected || g.id === selected);
        params.variableGroupId = found ? found.id : selected;
      }
      continue;
    } else if (param.name === 'entVersionId') {
      const spinner = ora('Listing Enterprise Versions...').start();
      const profiles = await getEnterpriseAppVersions({ entProfileId: params.entProfileId, publishType: '' });
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No version available';
        spinner.fail();
        return;
      }
      const versionMap = new Map(profiles.map((profile: any) => [profile.id, `${profile.version} (${profile.versionCode}) (${profile.id})`]));
      //@ts-ignore
      param.params = profiles.map((profile: any) => ({ 
        name: versionMap.get(profile.id), 
        message: `${profile.version} (${profile.versionCode}) (${profile.id})` 
      }));
      spinner.stop();
      
      const selectPrompt = new AutoComplete({
        name: param.name,
        message: param.description || 'App Version ID',
        initial: param.defaultValue,
        limit: 10,
        choices: Array.isArray(param.params) ? param.params : [],
      });
      const selected = await selectPrompt.run();
      const match = /\(([\w-]+)\)$/.exec(selected);
      if (match && match[1]) {
        params.entVersionId = match[1].trim();
      } else {
        params.entVersionId = selected;
      }
      continue;
    } else if (param.name === 'workflowId') {
      const spinner = ora('Listing Workflows...').start();
      if (params.workflowId) {
        const match = /\(([^)]+)\)$/.exec(params.workflowId);
        const selectedWorkflowId = match ? match[1] : params.workflowId;
        params.workflowId = selectedWorkflowId;
      }
      const workflows = await getWorkflows({ profileId: params.profileId || '' });
      if (!workflows || workflows.length === 0) {
        spinner.text = 'No workflows available';
        spinner.fail();
        return;
      }
      const workflowsList: any[] = workflows;
      param.params = workflows.map((workflow: any) => ({ name: `${workflow.workflowName} (${workflow.id})`, message: `${workflow.workflowName} (${workflow.id})` }));
      spinner.stop();
    } else if (param.name === 'configurationId') {
      const spinner = ora('Listing Configurations...').start();
      if (params.branchId && branchesList.length > 0) {
        const match = /\(([^)]+)\)$/.exec(params.branchId);
        const selectedBranchId = match ? match[1] : params.branchId;
        const selectedBranch = branchesList.find((b) => b.id === selectedBranchId);
        if (selectedBranch) {
          params.branchId = selectedBranch.id;
        }
      }
      if (params.configurationId && configurationsList.length > 0) {
        const match = /\(([^)]+)\)$/.exec(params.configurationId);
        const selectedConfigId = match ? match[1] : params.configurationId;
        const selectedConfig = configurationsList.find((c) => c.item1.id === selectedConfigId);
        if (selectedConfig) {
          params.configurationId = selectedConfig.item1.id;
        }
      }
      const configurations = await getConfigurations({ profileId: params.profileId || '' });
      if (!configurations || configurations.length === 0) {
        spinner.text = 'No configurations available';
        spinner.fail();
        return;
      }
      configurationsList.length = 0;
      configurationsList.push(...configurations);
      //@ts-ignore
      param.params = configurations.map((config: any) => ({ name: `${config.item1.configurationName} (${config.item1.id})`, message: `${config.item1.configurationName} (${config.item1.id})` }));
      spinner.stop();
      if (params.configurationId && configurationsList.length > 0) {
        const selectedConfig = configurationsList.find((c) => c.item1.configurationName === params.configurationId || c.item1.id === params.configurationId);
        if (selectedConfig) {
          params.configurationId = selectedConfig.item1.id;
        }
      }
    } else if (param.name === 'organizationId') {
      const spinner = ora('Listing Organizations...').start();
      const isAllOrganizations = param.defaultValue === 'all';
      const userInfo = await getUserInfo();
      const organizations = await getOrganizations();
      if (!organizations || organizations.length === 0) {
        spinner.text = 'No organizations available';
        spinner.fail();
        return;
      }
      param.defaultValue = param.defaultValue || 'all';
      const currentOrganization = organizations.find((org: any) => org.id === userInfo.currentOrganizationId);
      const organizationParams = (
        isAllOrganizations
          ? []
          : [{ name: `${currentOrganization.name} (${userInfo.currentOrganizationId})`, message: `${currentOrganization.name} (${userInfo.currentOrganizationId})  ❮❮❮ ` }]
      ).concat(
        organizations
          .filter((org: any) => isAllOrganizations || org.rootOrganizationId === currentOrganization.id)
          .map((organization: any) => ({
            name: `${organization.name} (${organization.id})`,
            message: `${organization.name} (${organization.id})`,
          }))
      );
      param.params = (isAllOrganizations ? [{ name: 'all', message: `All Organizations` }] : []).concat(organizationParams);
      params['currentOrganizationId'] = userInfo.currentOrganizationId;
      spinner.stop();
      // Prompt for selection and always extract UUID
      const selectPrompt = new AutoComplete({
        name: param.name,
        message: param.description || 'Organization',
        initial: param.defaultValue,
        limit: 10,
        choices: Array.isArray(param.params) ? param.params : [],
      });
      const selected = await selectPrompt.run();
      if (selected === 'all') {
        params.organizationId = 'all';
      } else {
        const match = /\(([^)]+)\)$/.exec(selected);
        if (match && match[1]) {
          params.organizationId = match[1].trim();
        } else {
          // fallback: try to find by name
          const found = organizations.find((o: any) => `${o.name} (${o.id})` === selected || o.id === selected);
          params.organizationId = found ? found.id : selected;
        }
      }
      continue;
    } else if (param.name === 'role') {
      const spinner = ora('Listing Roles...').start();
      const userinfo = params.userId ? await getOrganizationUserinfo({ organizationId: params.organizationId, userId: params.userId }): null;
      const roleList = await getRoleList();
      if (!roleList || roleList.length === 0) {
        spinner.text = 'No roles available.';
        spinner.fail();
          return { isError: true };
      }
      param.params = roleList.map((role: any) => ({ name: role.key, message: role.description }));

      if(param.autoFillForInteractiveMode){
        param.defaultValue = [];
        roleList.map((role: RoleType, index: number) => {
          if(role.isDefaultRole){
            param.defaultValue.push(index);
          }
        });
      }

      if(param.from === 'user' && userinfo?.roles) {
        param.params = param.params.filter((role: any) => userinfo.roles.includes(role.name));
        if(param.params.length === 0) {
          spinner.text = 'No roles for this user.';
          spinner.fail();
          return { isError: true };
        }
      } else if (param.required !== false && userinfo?.roles) {
        param.params = param.params.filter((role: any) => !userinfo.roles.includes(role.name));
        if (userinfo?.roles.includes('owner')) {
          param.params = [{ name: 'owner', message: 'Owner' }];
        }
      }
      spinner.stop();
    } else if (param.name === 'userId' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing Users...').start();
      let userList = await getOrganizationUsers({ organizationId: params.organizationId || params.currentOrganizationId || '' });
      if (!userList || userList.length === 0) {
        spinner.text = 'No users available';
      }
      if (param.required === false) {
        userList.unshift({ id: UNKNOWN_PARAM_VALUE, _message: ' Skip - (No user)' });
      }
      // Format user selection as email (id)
      param.params = userList.map((user: any) => ({ name: `${user.email} (${user.id})`, message: `${user.email} (${user.id})` }));
      if(!param.params?.length){
        spinner.text = "No users in this organization";
        spinner.fail();
        return { isError: true };
      }
      spinner.stop();
      // Prompt for selection and always extract UUID
      const selectPrompt = new AutoComplete({
        name: param.name,
        message: param.description || 'User',
        initial: param.defaultValue,
        limit: 10,
        choices: Array.isArray(param.params) ? param.params : [],
      });
      const selected = await selectPrompt.run();
      const match = /\(([^)]+)\)$/.exec(selected);
      if (match && match[1]) {
        params.userId = match[1].trim();
      } else {
        // fallback: try to find by name
        const found = userList.find((u: any) => `${u.email} (${u.id})` === selected || u.id === selected);
        params.userId = found ? found.id : selected;
      }
      continue;
    }else if(param.name === 'publishProfileId' && param.type === CommandParameterTypes.SELECT){
      const spinner = ora('Listing Publish Profiles...').start();
      const selectedPlatform = params["platform"];
      const publishProfiles = await getPublishProfiles({ platform: selectedPlatform });
      if (!publishProfiles || publishProfiles.length === 0) {
        spinner.text = 'No publish profiles available';
        spinner.fail();
        return { isError: true };
      }
      const profileParams = publishProfiles.map((profile: any) => {
        const display = `${profile.name} (${profile.id}) - ${(OperatingSystems as any)[profile.platformType]}`;
        return { name: display, message: display, _id: profile.id };
      });
      param.params = profileParams;
      params._publishProfileParams = profileParams;
      spinner.stop();
      const selectPrompt = new AutoComplete({
        name: param.name,
        message: param.description || 'Publish Profile',
        initial: param.defaultValue,
        limit: 10,
        choices: [...profileParams],
      });
      const selected = await selectPrompt.run();
      const match = /\(([^)]+)\)/.exec(selected);
      if (match && match[1]) {
        params.publishProfileId = match[1].trim();
      } else {
        params.publishProfileId = selected;
      }
      continue;
    }else if(param.name === 'appVersionId' && param.type === CommandParameterTypes.SELECT){
      const spinner = ora('Listing App Versions...').start();
      const selectedPlatform = params["platform"];
      let selectedPublishProfileId = params["publishProfileId"];
      const match = /\(([^)]+)\)/.exec(selectedPublishProfileId);
      if (match && match[1]) {
        selectedPublishProfileId = match[1].trim();
        params.publishProfileId = selectedPublishProfileId;
      }
      const appVersions = await getAppVersions({ platform: selectedPlatform, publishProfileId: selectedPublishProfileId });
      if (!appVersions || appVersions.length === 0) {
        spinner.text = 'No app versions available';
        spinner.fail();
        return { isError: true };
      } else {
        const appVersionChoices = appVersions.map((appVersion:any) => {
          const display = ` ${appVersion.name}(${appVersion.version}) - ${appVersion.id} ${appVersion.releaseCandidate ? '(Release Candidate)' : ''}`;
          return { name: display, message: display, _id: appVersion.id };
        });
        param.params = appVersionChoices;
        spinner.stop();
        const selectPrompt = new AutoComplete({
          name: param.name,
          message: param.description || 'App Version',
          initial: param.defaultValue,
          limit: 10,
          choices: [...appVersionChoices],
        });
        const selected = await selectPrompt.run();
        const matchAppVersion = /^\s*([0-9a-fA-F-]{36})\b/.exec(selected);
        if (matchAppVersion && matchAppVersion[1]) {
          params.appVersionId = matchAppVersion[1].trim();
        } else {
          const found = appVersionChoices.find((p:any) => p.name === selected || p.message === selected);
          if (found && found._id) {
            params.appVersionId = found._id;
          } else {
            params.appVersionId = selected;
          }
        }
        continue;
      }
    }else if(param.name === 'publishVariableGroupId' && param.type === CommandParameterTypes.SELECT){
      const spinner = ora('Listing Publish Variable Groups...').start();
      const groups = await getPublishVariableGroups();
      if (!groups || groups.length === 0) {
        spinner.text = 'No groups available';
        spinner.fail();
        return { isError: true };
      }else {
        param.params = groups.map((group:any) => ({name:`${group.name} (${group.id})`, message: `${group.name} (${group.id})`}));
        spinner.stop();
        // Prompt for selection and always extract UUID
        const selectPrompt = new AutoComplete({
          name: param.name,
          message: param.description || 'Publish Variable Group',
          initial: param.defaultValue,
          limit: 10,
          choices: Array.isArray(param.params) ? param.params : [],
        });
        const selected = await selectPrompt.run();
        const match = /\(([^)]+)\)$/.exec(selected);
        let selectedId = match && match[1] ? match[1].trim() : null;
        if (!selectedId) {
          // fallback: try to find by name
          const found = groups.find((g: any) => `${g.name} (${g.id})` === selected || g.id === selected);
          selectedId = found ? found.id : selected;
        }
        const validGroup = groups.find((g: any) => g.id === selectedId);
        if (!validGroup) {
          spinner.fail(`Selected variable group not found! Lütfen geçerli bir grup seçin.`);
          return { isError: true };
        }
        params.publishVariableGroupId = selectedId;
        params.variableGroupId = undefined;
        continue;
      }
    }
    else if (param.name === 'email' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing Invitations...').start();
      const invitationsList = await getOrganizationInvitations({ organizationId: params.organizationId || params.currentOrganizationId || '' });
      if (param.required !== false && (!invitationsList || invitationsList.length === 0)) {
        spinner.text = 'No invitations available';
        spinner.fail();
        return;
      }
      if (param.required === false) {
        invitationsList.unshift({ userEmail: UNKNOWN_PARAM_VALUE, _message: 'Skip - (No email)' });
      }
      param.params = invitationsList.map((invitation: any) => ({ name: invitation.userEmail, message: invitation._message || invitation.userEmail }));
      spinner.stop();
    }else if (param.name === 'value' && params.isSecret) {
      param.type = CommandParameterTypes.PASSWORD;
    }else if (param.name === 'countryCode' && param.type === CommandParameterTypes.SELECT) {
      const countries = await getCountries();
      param.params = countries.map((country) => ({ name: country.alpha2, message: `${country.name}` }));
    }else if (param.name === 'certificateBundleId' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing Certificate Bundles...').start();
      const p12Certs = await getiOSP12Certificates();
      const certificates = [...p12Certs];
      if (!certificates || certificates.length === 0) {
        spinner.text = 'No certificate bundle available';
        spinner.fail();
        return { isError: true };
      } else {
        // Format: 'Certificate Name (Team ID) (UUID)'
        param.params = certificates.map((certificate: any) => {
          let certName = certificate.name || 'Unknown';
          let teamId = certificate.teamId ? `: ${certificate.teamId}` : '';
          let appleTeam = certificate.appleTeamId ? ` (${certificate.appleTeamId})` : '';
          let display = `${certName}${teamId}${appleTeam} (${certificate.id})`;
          return { name: display, message: display };
        });
        spinner.stop();
        // Prompt for selection and always extract UUID
        const selectPrompt = new AutoComplete({
          name: param.name,
          message: param.description || 'Certificate Bundle',
          initial: param.defaultValue,
          limit: 10,
          choices: Array.isArray(param.params) ? param.params : [],
        });
        const selected = await selectPrompt.run();
        // Extract the UUID from the last parentheses
        const match = /\(([^()]+)\)\s*$/.exec(selected);
        if (match && match[1]) {
          params.certificateBundleId = match[1].trim();
        } else {
          // fallback: try to find by name
          const found = certificates.find((c: any) => selected.includes(c.id));
          params.certificateBundleId = found ? found.id : selected;
        }
        continue;
      }
    }else if (param.name === 'certificateId' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing Certificates...').start();
      const p12Certs = await getiOSP12Certificates();
      const csrCerts = await getiOSCSRCertificates();
      const certificates = [...p12Certs, ...csrCerts];
      if (!certificates || certificates.length === 0) {
        spinner.text = 'No certificate available';
        spinner.fail();
        return { isError: true };
      } else {
        // Format: 'Certificate Name (Team ID) (UUID)' for P12, 'csr: Name - email (UUID)' for CSR
        param.params = certificates.map((certificate: any) => {
          if (certificate.extension === 'P12') {
            let certName = certificate.name || 'Unknown';
            let teamId = certificate.teamId ? `: ${certificate.teamId}` : '';
            let appleTeam = certificate.appleTeamId ? ` (${certificate.appleTeamId})` : '';
            let display = `${certName}${teamId}${appleTeam} (${certificate.id})`;
            return { name: display, message: display };
          } else if (certificate.extension === 'CSR') {
            let display = `csr: ${certificate.name || 'Unknown'} - ${certificate.email || ''} (${certificate.id})`;
            return { name: display, message: display };
          } else {
            let display = `${certificate.name || 'Unknown'} (${certificate.id})`;
            return { name: display, message: display };
          }
        });
        spinner.stop();
        // Prompt for selection and always extract UUID
        const selectPrompt = new AutoComplete({
          name: param.name,
          message: param.description || 'Certificate',
          initial: param.defaultValue,
          limit: 10,
          choices: Array.isArray(param.params) ? param.params : [],
        });
        const selected = await selectPrompt.run();
        // Extract the UUID from the last parentheses
        const match = /\(([^()]+)\)\s*$/.exec(selected);
        if (match && match[1]) {
          params.certificateId = match[1].trim();
        } else {
          // fallback: try to find by name
          const found = certificates.find((c: any) => selected.includes(c.id));
          params.certificateId = found ? found.id : selected;
        }
        continue;
      }
    }else if (param.name === 'keystoreId' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing Keystores...').start();
      const keystores = await getAndroidKeystores();
      if (!keystores || keystores.length === 0) {
        spinner.text = 'No keystore available';
        spinner.fail();
        return { isError: true };
      } else {
        // Format: 'Name (ID)'
        param.params = keystores.map((keystore: any) => {
          const display = `${keystore.name} (${keystore.id})`;
          return { name: display, message: display };
        });
        spinner.stop();
        // Prompt for selection and always extract UUID
        const selectPrompt = new AutoComplete({
          name: param.name,
          message: param.description || 'Keystore',
          initial: param.defaultValue,
          limit: 10,
          choices: Array.isArray(param.params) ? param.params : [],
        });
        const selected = await selectPrompt.run();
        // Extract the UUID from the last parentheses
        const match = /\(([^()]+)\)\s*$/.exec(selected);
        if (match && match[1]) {
          params.keystoreId = match[1].trim();
        } else {
          // fallback: try to find by name
          const found = keystores.find((k: any) => selected.includes(k.id));
          params.keystoreId = found ? found.id : selected;
        }
        continue;
      }
    }else if (param.name === 'provisioningProfileId' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing Provisioning Profiles...').start();
      const profiles = await getProvisioningProfiles();
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No provisioning profile available';
        spinner.fail();
        return { isError: true };
      } else {
        // Format: 'Name (ID)'
        param.params = profiles.map((profile: any) => {
          const display = `${profile.name} (${profile.id})`;
          return { name: display, message: display };
        });
        spinner.stop();
        // Prompt for selection and always extract UUID
        const selectPrompt = new AutoComplete({
          name: param.name,
          message: param.description || 'Provisioning Profile',
          initial: param.defaultValue,
          limit: 10,
          choices: Array.isArray(param.params) ? param.params : [],
        });
        const selected = await selectPrompt.run();
        // Extract the UUID from the last parentheses
        const match = /\(([^()]+)\)\s*$/.exec(selected);
        if (match && match[1]) {
          params.provisioningProfileId = match[1].trim();
        } else {
          // fallback: try to find by name
          const found = profiles.find((p: any) => selected.includes(p.id));
          params.provisioningProfileId = found ? found.id : selected;
        }
        continue;
      }
    }else if (param.name === 'testingGroupIds' && param.type === CommandParameterTypes.MULTIPLE_SELECT) {
      const spinner = ora('Listing Testing Groups...').start();
      const groups = await getTestingGroups();
      const selectedProfile = await getDistributionProfileById(params);
      if (!groups || groups.length === 0) {
        spinner.text = 'No testing group available';
        spinner.fail();
        return { isError: true };
      } else {
        // Format: Name (UUID)
        param.params = groups.map((group: any) => {
          const display = `${group.name} (${group.id})`;
          return { name: display, message: display };
        });
        // Default value as indices of selectedProfile.testingGroupIds in groups
        param.defaultValue = selectedProfile?.testingGroupIds
          ? selectedProfile.testingGroupIds.map((id: any) => {
              const _index = groups.findIndex((group: any) => group.id === id);
              return _index !== -1 ? _index : undefined;
            }).filter((v: any) => v !== undefined)
          : [];
        spinner.stop();
      }
    }else if (param.name === 'testingGroupId' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing Testing Groups...').start();
      const groups = await getTestingGroups();
      if (!groups || groups.length === 0) {
        spinner.text = 'No testing group available';
        spinner.fail();
        return { isError: true };
      } else {
        // Format: Name (UUID)
        param.params = groups.map((group: any) => {
          const display = `${group.name} (${group.id})`;
          return { name: display, message: display };
        });
        spinner.stop();
        // Prompt for selection and always extract UUID
        const selectPrompt = new AutoComplete({
          name: param.name,
          message: param.description || 'Testing Group',
          initial: param.defaultValue,
          limit: 10,
          choices: Array.isArray(param.params) ? param.params : [],
        });
        const selected = await selectPrompt.run();
        const match = /\(([^()]+)\)\s*$/.exec(selected);
        if (match && match[1]) {
          params.testingGroupId = match[1].trim();
        } else {
          params.testingGroupId = selected;
        }
        continue;
      }
    }else if (param.name === 'testerEmail' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing Testers...').start();
      const group = await getTestingGroupById(params);
      const testers = group?.testers;
      if (!testers || testers.length === 0) {
        spinner.text = 'No tester available';
        spinner.fail();
        return { isError: true };
      }else {
        param.params = testers.map((tester:any) => ({name:tester, message: tester}));
        spinner.stop();
      }
    } else if (param.name === 'path' && param.description && param.description.includes('certificate to be downloaded')) {
      // Set default path to Downloads folder for certificate downloads
      param.defaultValue = path.join(os.homedir(), 'Downloads');
    }

    // If has paramType and type  match to selected type
    if (!param.paramType || param.paramType === params.type) {
      // Prompt for parameter
      if ([CommandParameterTypes.STRING, CommandParameterTypes.PASSWORD].includes(param.type) && !param.skipForInteractiveMode) {
        const stringPrompt = await prompt([
          {
            type: param.type,
            name: param.name,
            message: param.description,
            validate(value: string) {
              if (value.length === 0 && param.required !== false) {
                return "This field is required";
              } else if (['app', 'filePath'].includes(param.name)) {
                try {
                  const expandedPath = expandTilde(value);
                  if (!fs.existsSync(expandedPath)) {
                    return "File not exists. Please enter a valid file path";
                  }
                } catch (error) {
                  return "Invalid file path. Please enter a valid file path";
                }
              }
              return true;
            },
          },
        ]);
        let value = (stringPrompt as any)[Object.keys(stringPrompt)[0]];
        if (param.name === 'filePath') {
          value = expandTilde(value);
        }
        (params as any)[param.name] = value;
      } else if (param.type === CommandParameterTypes.BOOLEAN) {
        const booleanPrompt = new BooleanPrompt({
          name: param.name,
          message: param.description,
        });
        //@ts-ignore
        params[param.name] = await booleanPrompt.run();
      } else if (param.type === CommandParameterTypes.SELECT && param.params) {
        const selectPrompt = new AutoComplete({
          name: param.name,
          message: `${param.description}${param?.params?.length > 10 ? ` (${param.params.length} Options)` : ''}`,
          initial: param.defaultValue,
          limit: 10,
          choices: [
            //@ts-ignore
            ...param.params.map((val: any) => val),
          ],
        });
        (params as any)[param.name] = await selectPrompt.run();

      } else if (param.type === CommandParameterTypes.MULTIPLE_SELECT && param.params) {
        const selectPrompt = new AutoComplete({
          name: param.name,
          message: `${param.description}${param?.params?.length > 10 ? ` (${param.params.length} Options)` : ''} (Multiple selection with 'space')`,
          initial: param.defaultValue,
          limit: 10,
          multiple: true,
          choices: [
            //@ts-ignore
            ...param.params.map((val: any) => val),
          ],
        });
        const selectedGroups = await selectPrompt.run();
        // If this is testingGroupIds, map from "Name (UUID)" to UUIDs
        if (param.name === 'testingGroupIds') {
          const groupIds = selectedGroups.map((selected: string) => {
            const match = /\(([^()]+)\)\s*$/.exec(selected);
            return match && match[1] ? match[1].trim() : selected;
          });
          params.testingGroupIds = groupIds;
        } else {
          (params as any)[param.name] = selectedGroups;
        }
      }
    }
  }
  if (params.commitId && commitsList.length > 0) {
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(params.commitId)) {
      const match = /\(([^)]+)\)$/.exec(params.commitId);
      const selectedCommitId = match ? match[1] : params.commitId;
      const selectedCommit = commitsList.find((c) => c.id === selectedCommitId);
      if (selectedCommit) {
        params.commitId = selectedCommit.id;
      }
    }
  }
  if (params.configurationId && configurationsList.length > 0) {
    const selectedConfig = configurationsList.find((c) => c.item1.configurationName === params.configurationId || c.item1.id === params.configurationId || `${c.item1.configurationName} (${c.item1.id})` === params.configurationId);
    if (selectedConfig) {
      params.configurationId = selectedConfig.item1.id;
    }
  }
  if (params.workflowId && Array.isArray(params.workflowId) === false) {
    const workflows = await getWorkflows({ profileId: params.profileId || '' });
    const selectedWorkflow = workflows.find((w: any) => w.workflowName === params.workflowId || w.id === params.workflowId || `${w.workflowName} (${w.id})` === params.workflowId);
    if (selectedWorkflow) {
      params.workflowId = selectedWorkflow.id;
    }
  }
  return params;
};

const handleCommandParamsAndArguments = async (selectedCommand: CommandType, parentCommand: any): Promise<ProgramCommand | undefined> => {
  const params = (await handleInteractiveParamsOrArguments(selectedCommand.params || [])) || {};
  const args = (await handleInteractiveParamsOrArguments(selectedCommand.arguments || [])) || {};
  return createCommandActionCallback({
    parent: parentCommand || null,
    name: () => selectedCommand.command,
    opts: () => params,
    args: () => Object.values(args),
  });
};

const handleSelectedCommand = async (command: CommandType, __parentCommand?: any): Promise<ProgramCommand | undefined> => {
  const preparedCommand = await handleCommandParamsAndArguments(command, __parentCommand);
  if (command.subCommands?.length) {
    const availableChoices = command.subCommands.filter((cmd) => !cmd.ignore);

    // If there's only one subcommand available, execute it directly
    if (availableChoices.length === 1) {
      return await handleSelectedCommand(availableChoices[0], preparedCommand);
    }

    const choices = availableChoices.map((cmd, index) => {
      return { name: cmd.command, message: `${index + 1}. ${cmd.description}` };
    });

    if (navigationStack.length > 0) {
      const isTopLevelDirectCommand = process.argv.length > 2 && ['-i', '--interactive'].every(flag => !process.argv.includes(flag));
      choices.push({
        name: 'back',
        message: navigationStack.length === 1 && isTopLevelDirectCommand ? '⬅ Exit' : '⬅ Back'
      });
    }

    const commandSelect = new AutoComplete({
      name: 'action',
      limit: 10,
      message: `Which sub-command of "${command.command}" do you want to run? (${choices.length} Options)`,
      choices: choices,
    });

    const selectedActionName = await commandSelect.run();

    if (selectedActionName === 'back') {
      navigationStack.pop();
      if (navigationStack.length === 0) {
        // Signal to exit if at top-level
        return { isBackToMainMenu: true } as any;
      }
      const parentCommand = navigationStack[navigationStack.length - 1];
      return await handleSelectedCommand(parentCommand.command, parentCommand.preparedCommand);
    }

    const selectedCommand = availableChoices.find((cmd) => cmd.command === selectedActionName);
    if (selectedCommand) {
      navigationStack.push({ command: selectedCommand, preparedCommand });
      return await handleSelectedCommand(selectedCommand, preparedCommand);
    }
  }

  return preparedCommand;
};

const runCommandsInteractivelyInner = async () => {
  let selectedCommand: (typeof Commands)[number];
  let selectedCommandDescription = '';
  let selectedCommandIndex = -1;
  const argv = minimist(process.argv.slice(2));
  if (argv._.length === 1 && typeof argv._[0] === 'string') {
    const directCommand = Commands.find((cmd) => cmd.command === argv._[0]);
    if (directCommand) {
      navigationStack.length = 0;
      navigationStack.push({ command: directCommand, preparedCommand: undefined });

      const preparedProgramCommand = await handleSelectedCommand(directCommand, {});
      if (preparedProgramCommand && typeof preparedProgramCommand === 'object') {
        if ((preparedProgramCommand as any).isBackToMainMenu) {
          console.log('Goodbye! 👋');
          process.exit(0);
        } else {
          await runCommand(preparedProgramCommand);
        }
      }
      return;
    }
  }
  // Distinguish between explicit interactive mode (-i/--interactive) and default (no params)
  const isExplicitInteractiveMode = argv.i || argv.interactive;
  const isDefaultInteractiveMode = process.argv.length === 2;

  const showMainMenu = async () => {
    if (!hasShownLogo) {
      console.info(
        chalk.hex(APPCIRCLE_COLOR)(
          `
      ███████ ██████╗ ██████╗  ██████╗██╗██████╗  ██████╗██╗     ███████╗
      ██╔══██╗██╔══██╗██╔══██╗██╔════╝██║██╔══██╗██╔════╝██║     ██╔════╝
      ███████║██████╔╝██████╔╝██║     ██║██████╔╝██║     ██║     █████╗  
      ██╔══██║██╔═══╝ ██╔═══╝ ██║     ██║██╔══██╗██║     ██║     ██╔══╝  
      ██║  ██║██║     ██║     ╚██████╗██║██║  ██║╚██████╗███████╗███████╗
      ╚═╝  ╚═╝╚═╝     ╚═╝      ╚═════╝╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚══════╝             
                  `
        )
      );
      hasShownLogo = true;
    }

    const choices = [
      ...Commands.map((command, index) => `${index + 1}. ${command.description}`),
      '0. Exit'
    ];

    const commandSelect = new AutoComplete({
      name: 'command',
      message: `What do you want to do?${` (${Commands.length} Options)`}`,
      limit: 10,
      choices,
      initial: previousSelections.get('main'),
    });

    const selected = await commandSelect.run();
    
    if (selected === '0. Exit') {
      console.log('Goodbye! 👋');
      throw new AppcircleExitError('User exited from main menu', 0);
    }

    selectedCommandIndex = Number(selected.split('.')[0]) - 1;
    previousSelections.set('main', selectedCommandIndex);
    
    selectedCommand = Commands[selectedCommandIndex];
    navigationStack.length = 0;
    navigationStack.push({ command: selectedCommand, preparedCommand: undefined });

    const preparedProgramCommand = await handleSelectedCommand(selectedCommand, {});
    if (preparedProgramCommand) {
      // Check if this is a signal to return to main menu
      if ((preparedProgramCommand as any).isBackToMainMenu) {
        // Clear navigation stack and return signal to show main menu again
        navigationStack.length = 0;
        return { shouldShowMainMenuAgain: true };
      }
      
      try {
        await runCommand(preparedProgramCommand);
        // For successful completion without error, check if we should return to main menu
        if (isExplicitInteractiveMode) {
          return { shouldShowMainMenuAgain: true };
        }
        // For default interactive mode, just exit after running the command
      } catch (commandError) {
        if (commandError instanceof AppcircleExitError) {
          if (commandError.code === 0) {
            // Successful completion, only show main menu again if in explicit interactive mode
            if (isExplicitInteractiveMode) {
              return { shouldShowMainMenuAgain: true };
            }
            return;
          } else {
            // Command failed, re-throw to be handled by outer catch
            throw commandError;
          }
        } else {
          // Non-AppcircleExitError, re-throw
          throw commandError;
        }
      }
    }
  };

  // Main loop for interactive mode
  while (true) {
    const result = await showMainMenu();
    if (!result || !(result as any).shouldShowMainMenuAgain) {
      break;
    }
  }
};

export const runCommandsInteractively = async () => {
  try {
    await runCommandsInteractivelyInner();
  } catch (err) {
    if (err instanceof AppcircleExitError) {
      if (err.code === 0) {
        process.exit(0);
      } else {
        console.error(err.message);
        // Only restart in explicit interactive mode
        const argv = minimist(process.argv.slice(2));
        const isExplicitInteractiveMode = argv.i || argv.interactive;
        if (isExplicitInteractiveMode) {
          await runCommandsInteractively();
        } else {
          process.exit(err.code);
        }
      }
    } else {
      throw err;
    }
  }
};
