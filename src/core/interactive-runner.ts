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
      const spinner = ora('Listing branches...').start();
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
      spinner.text = 'Branches listed';
      spinner.succeed();
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
      const spinner = ora('Listing build profiles...').start();
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
      spinner.text = 'Build profiles listed';
      spinner.succeed();
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
      const spinner = ora('Listing commits...').start();
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
      spinner.text = 'Commits listed';
      spinner.succeed();
      if (params.commitId) {
        const match = /\(([^)]+)\)$/.exec(params.commitId);
        if (match && match[1]) {
          params.commitId = match[1];
        }
      }
    } else if (param.name === 'buildId') {
      const spinner = ora('Listing builds...').start();
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
      const spinner = ora('Listing enterprise profiles...').start();
      const profiles = await getEnterpriseProfiles();
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No enterprise profile available';
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = profiles.map((profile: any) => ({ name: profile.id, message: `${profile.id} (${profile.name})` }));
      spinner.text = 'Enterprise profiles listed';
      spinner.succeed();
    } else if (param.name === 'distProfileId') {
      const spinner = ora('Listing distribution profiles...').start();
      const profiles = await getDistributionProfiles();
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No distribution profile available';
        spinner.fail();
        process.exit(1);
      }
      //@ts-ignore
      param.params = profiles.map((profile: any) => ({ name: profile.id, message: `${profile.id} (${profile.name})` }));
      spinner.text = 'Distribution profiles listed';
      spinner.succeed();
    } else if (param.name === 'variableGroupId') {
      const spinner = ora('Listing environment variable groups...').start();
      const groups = await getEnvironmentVariableGroups();
      if (!groups || groups.length === 0) {
        spinner.text = 'No environment variable groups available';
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = groups.map((group: any) => ({ name: `${group.name} (${group.id})`, message: `${group.name} (${group.id})` }));
      spinner.succeed();
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
      const spinner = ora('Listing enterprise versions...').start();
      const profiles = await getEnterpriseAppVersions({ entProfileId: params.entProfileId, publishType: '' });
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No version available';
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = profiles.map((profile: any) => ({ name: profile.id, message: `${profile.version} (${profile.versionCode})` }));
      spinner.text = 'Enterprise versions listed';
      spinner.succeed();
    } else if (param.name === 'workflowId') {
      const spinner = ora('Listing workflows...').start();
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
      spinner.text = 'Workflows listed';
      spinner.succeed();
    } else if (param.name === 'configurationId') {
      const spinner = ora('Listing configurations...').start();
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
      spinner.text = 'Configurations listed';
      spinner.succeed();
      if (params.configurationId && configurationsList.length > 0) {
        const selectedConfig = configurationsList.find((c) => c.item1.configurationName === params.configurationId || c.item1.id === params.configurationId);
        if (selectedConfig) {
          params.configurationId = selectedConfig.item1.id;
        }
      }
    } else if (param.name === 'organizationId') {
      const spinner = ora('Listing organizations...').start();
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
          : [{ name: userInfo.currentOrganizationId, message: `${userInfo.currentOrganizationId} (➞ ${currentOrganization.name})  ❮❮❮ ` }]
      ).concat(
        organizations
          .filter((org: any) => isAllOrganizations || org.rootOrganizationId === currentOrganization.id)
          .map((organization: any) => ({
            name: organization.id,
            message: `${organization.id} (${isAllOrganizations && !organization.rootOrganizationId ? '➞' : ' ↳'} ${organization.name})`,
          }))
      );
      param.params = (isAllOrganizations ? [{ name: 'all', message: `All Organizations` }] : []).concat(organizationParams);
      params['currentOrganizationId'] = userInfo.currentOrganizationId;
      spinner.text = 'Organizations listed';
      spinner.succeed();
    } else if (param.name === 'role') {
      const spinner = ora('Listing roles...').start();
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
      spinner.text = 'Roles listed';
      spinner.succeed();
    } else if (param.name === 'userId' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing users...').start();
      let userList = await getOrganizationUsers({ organizationId: params.organizationId || params.currentOrganizationId || '' });
      if (!userList || userList.length === 0) {
        spinner.text = 'No users available';
      }
      if (param.required === false) {
        userList.unshift({ id: UNKNOWN_PARAM_VALUE, _message: ' Skip - (No user)' });
      }
      param.params = userList.map((user: any) => ({ name: user.id, message: user._message || ` ${user.id} (${user.email})` }));
      spinner.text = 'Users listed';
      if(!param.params?.length){
        spinner.text = "No users in this organization";
        spinner.fail();
        return { isError: true };
      }
      spinner.succeed();
    }else if(param.name === 'publishProfileId' && param.type === CommandParameterTypes.SELECT){
      const spinner = ora('Listing publish profiles...').start();
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
      spinner.text = 'Publish profiles listed';
      spinner.succeed();
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
      const spinner = ora('Listing app versions...').start();
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
        spinner.text = 'App versions listed';
        spinner.succeed();
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
      const spinner = ora('Listing publish variable groups...').start();
      const groups = await getPublishVariableGroups();
      if (!groups || groups.length === 0) {
        spinner.text = 'No groups available';
        spinner.fail();
        return { isError: true };
      }else {
        param.params = groups.map((group:any) => ({name:`${group.name} (${group.id})`, message: `${group.name} (${group.id})`}));
        spinner.text = 'Publish variable groups listed';
        spinner.succeed();
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
      const spinner = ora('Listing invitations...').start();
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
      spinner.text = 'Invitations listed';
      spinner.succeed();
    }else if (param.name === 'value' && params.isSecret) {
      param.type = CommandParameterTypes.PASSWORD;
    }else if (param.name === 'countryCode' && param.type === CommandParameterTypes.SELECT) {
      const countries = await getCountries();
      param.params = countries.map((country) => ({ name: country.alpha2, message: `${country.name}` }));
    }else if (param.name === 'certificateBundleId' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing certificate bundles...').start();
      const p12Certs = await getiOSP12Certificates();
      const certificates = [...p12Certs];
      if (!certificates || certificates.length === 0) {
        spinner.text = 'No certificate bundle available';
        spinner.fail();
        return { isError: true };
      }else {
        param.params = certificates.map((certificate:any) => ({name:certificate.id, message: ` ${certificate.id} (${certificate.name})`}));
        spinner.text = 'Certificate bundles listed';
        spinner.succeed();
      }
    }else if (param.name === 'certificateId' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing certificates...').start();
      const p12Certs = await getiOSP12Certificates();
      const csrCerts = await getiOSCSRCertificates();
      const certificates = [...p12Certs,...csrCerts];
      if (!certificates || certificates.length === 0) {
        spinner.text = 'No certificate available';
        spinner.fail();
        return { isError: true };
      }else {
        param.params = certificates.map((certificate:any) => ({name:certificate.id, message: ` ${certificate.id} (${certificate.name})`}));
        spinner.text = 'Certificates listed';
        spinner.succeed();
      }
    }else if (param.name === 'keystoreId' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing keystores...').start();
      const keystores = await getAndroidKeystores();
      if (!keystores || keystores.length === 0) {
        spinner.text = 'No keystore available';
        spinner.fail();
        return { isError: true };
      }else {
        param.params = keystores.map((keystore:any) => ({name:keystore.id, message: ` ${keystore.id} (${keystore.name})`}));
        spinner.text = 'Keystores listed';
        spinner.succeed();
      }
    }else if (param.name === 'provisioningProfileId' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing provisioning profiles...').start();
      const profiles = await getProvisioningProfiles();
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No provisioning profile available';
        spinner.fail();
        return { isError: true };
      }else {
        param.params = profiles.map((profile:any) => ({name:profile.id, message: ` ${profile.id} (${profile.name})`}));
        spinner.text = 'Provisioning profiles listed';
        spinner.succeed();
      }
    }else if (param.name === 'testingGroupIds' && param.type === CommandParameterTypes.MULTIPLE_SELECT) {
      const spinner = ora('Listing testing groups...').start();
      const groups = await getTestingGroups();
      const selectedProfile = await getDistributionProfileById(params);
      if (!groups || groups.length === 0) {
        spinner.text = 'No testing group available';
        spinner.fail();
        return { isError: true };
      }else {
        param.params = groups.map((group:any) => ({name:group.id, message: ` ${group.id} (${group.name})`}));
        param.defaultValue = selectedProfile?.testingGroupIds ? selectedProfile?.testingGroupIds?.map?.((id: any, index:number) => {
          const _index = groups.findIndex((group: any) => group.id === id);
          if(_index !== -1){
            return _index;
          }
        }) : [];
        spinner.text = 'Testing groups listed';
        spinner.succeed();
      }
    }else if (param.name === 'testingGroupId' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing testing groups...').start();
      const groups = await getTestingGroups();
      if (!groups || groups.length === 0) {
        spinner.text = 'No testing group available';
        spinner.fail();
        return { isError: true };
      }else {
        param.params = groups.map((group:any) => ({name:group.id, message: ` ${group.id} (${group.name})`}));
        spinner.text = 'Testing groups listed';
        spinner.succeed();
      }
    }else if (param.name === 'testerEmail' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Listing testers...').start();
      const group = await getTestingGroupById(params);
      const testers = group?.testers;
      if (!testers || testers.length === 0) {
        spinner.text = 'No tester available';
        spinner.fail();
        return { isError: true };
      }else {
        param.params = testers.map((tester:any) => ({name:tester, message: tester}));
        spinner.text = 'Testers listed';
        spinner.succeed();
      }
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
        (params as any)[param.name] = await selectPrompt.run();
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
    const commandSelect = new AutoComplete({
      name: 'action',
      limit: 10,
      message: `Which sub-command of "${command.command}" do you want to run?${` (${command.subCommands.length} Options)`}`,
      choices: command.subCommands.filter((cmd) => !cmd.ignore).map((cmd, index) => {
        return { name: cmd.command, message: `${index + 1}. ${cmd.description}` };
      }),
    });
    const slectedCommandName = await commandSelect.run();
    const selectedCommand = command.subCommands.find((s) => s.command === slectedCommandName);
    return handleSelectedCommand(selectedCommand as CommandType, preparedCommand);
  }
  return preparedCommand;
};

export const runCommandsInteractively = async () => {
  let selectedCommand: (typeof Commands)[number];
  let selectedCommandDescription = '';
  let selectedCommandIndex = -1;

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

  const commandSelect = new AutoComplete({
    name: 'command',
    message: `What do you want to do?${` (${Commands.length} Options)`}`,
    limit: 10,
    choices: [...Commands.map((command, index) => `${index + 1}. ${command.description}`)],
  });

  selectedCommandIndex = Number((await commandSelect.run()).split('.')[0]) - 1;
  selectedCommand = Commands[selectedCommandIndex];

  const preparedProgramCommand = await handleSelectedCommand(selectedCommand, {});
  if (preparedProgramCommand) {
    runCommand(preparedProgramCommand);
  }
};
