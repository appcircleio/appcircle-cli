import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import moment from 'moment';
//@ts-ignore https://github.com/enquirer/enquirer/issues/212
import { prompt, Select, AutoComplete, BooleanPrompt, MultiSelect } from 'enquirer';
import { runCommand } from './command-runner';
import { Commands, CommandParameterTypes, CommandTypes, CommandType } from './commands';
import { APPCIRCLE_COLOR, OperatingSystems, UNKNOWN_PARAM_VALUE, globalVariables } from '../constant';
import { createOra } from '../utils/orahelper';
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
} from '../services';
import { DefaultEnvironmentVariables, getConfigStore } from '../config';
import { ProgramCommand, createCommandActionCallback } from '../program';
import { Command } from 'commander';

const prepareConfigCommand = async () => {
  const commandSelect = new Select({
    name: 'action',
    message: 'Which action do you want?',
    choices: [
      { name: 'list', message: '1. List (List CLI properties for all configurations)' },
      { name: 'get', message: '2. Get (Print the value of an CLI currently active configuration property)' },
      { name: 'set', message: '3. Set (Set a CLI currently active configuration property)' },
      { name: 'current', message: '4. Current (Set a CLI currently active configuration property)' },
      { name: 'add', message: '5. Add (Add a new CLI configuration environment)' },
      { name: 'reset', message: '6. Reset (Reset a CLI configuration to default)' },
    ],
  });
  const action = await commandSelect.run();

  const configActionCommandArgs = [] as string[];
  const configActionCommand = {
    parent: { name: () => 'config', args: () => [], opts: () => ({}), parent: {} },
    name: () => action,
    args: () => configActionCommandArgs,
    opts: () => ({}),
  };

  const keySelect = async (questionStr: string = 'Key') => {
    const keySelect = new Select({
      name: 'action',
      message: questionStr,
      choices: Object.keys(DefaultEnvironmentVariables),
    });
    const key = await keySelect.run();
    configActionCommandArgs.push(key);
  };

  const valueInput = async () => {
    const valueResponse = (await prompt({
      type: 'input',
      name: 'value',
      message: 'Value',
    })) as any;
    configActionCommandArgs.push(valueResponse.value as string);
  };

  const envSelect = async (questionStr: string = 'Which key do you want?') => {
    const envSelect = new Select({
      name: 'action',
      message: 'Environment',
      choices: Object.keys(getConfigStore().envs),
    });
    const key = await envSelect.run();
    configActionCommandArgs.push(key);
  };

  let args = [];
  switch (action) {
    case 'reset':
    case 'list': {
      break;
    }
    case 'get': {
      await keySelect();
      break;
    }
    case 'set': {
      await keySelect();
      await valueInput();
      break;
    }
    case 'current': {
      await envSelect();
      break;
    }
    case 'add': {
      await valueInput();
      break;
    }
  }
  return configActionCommand;
};

const handleInteractiveParamsOrArguments = async (
  commandParams: CommandType['params'] | CommandType['arguments'] = []
): Promise<Record<string, any> | undefined> => {
  let params: any = {};
  for (let param of commandParams) {
    if (param.name === 'branchId') {
      const spinner = ora('Branches fetching').start();

      const branches = (await getBranches({ profileId: params.profileId || '' })).branches;
      if (!branches || branches.length === 0) {
        spinner.text = 'No branches available';
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = branches.map((branch: any) => ({ name: branch.id, message: `${branch.id} (${branch.name})` }));
      spinner.text = 'Branches fetched';
      spinner.succeed();
    } else if (param.name === 'profileId') {
      const spinner = ora('Build Profiles fetching').start();
      const profiles = await getBuildProfiles();
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No build profile available';
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = profiles.map((profile: any) => ({ name: profile.id, message: `${profile.id} (${profile.name})` }));
      spinner.text = 'Build Profiles fetched';
      spinner.succeed();
    } else if (param.name === 'commitId') {
      const spinner = ora('Commits fetching').start();
      const commits = await getCommits({ profileId: params.profileId || '', branchId: params.branchId || '' });
      if (!commits || commits.length === 0) {
        spinner.text = 'No commits available';
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = commits.map((commit: any) => ({
        name: commit.id,
        message: `${commit.id} (${JSON.stringify(commit.message.substring(0, 20) + '...')})`,
      }));
      spinner.text = 'Commits fetched';
      spinner.succeed();
    } else if (param.name === 'buildId') {
      const spinner = ora('Builds fetching').start();
      const builds = (await getBuildsOfCommit({ commitId: params.commitId })).builds;
      if (!builds || builds.length === 0) {
        spinner.text = 'No builds available';
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = builds.map((build: any) => ({ name: build.id, message: `${build.id} (${moment(build.startDate).calendar()})` }));
      spinner.text = 'Builds fetched';
      spinner.succeed();
    } else if (param.name === 'entProfileId') {
      const spinner = ora('Enterprise Profiles fetching').start();
      const profiles = await getEnterpriseProfiles();
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No enterprise profile available';
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = profiles.map((profile: any) => ({ name: profile.id, message: `${profile.id} (${profile.name})` }));
      spinner.text = 'Enterprise Profiles fetched';
      spinner.succeed();
    } else if (param.name === 'distProfileId') {
      const spinner = ora('Distribution Profiles fetching').start();
      const profiles = await getDistributionProfiles();
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No distribution profile available';
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = profiles.map((profile: any) => ({ name: profile.id, message: `${profile.id} (${profile.name})` }));
      spinner.text = 'Distribution Profiles fetched';
      spinner.succeed();
    } else if (param.name === 'variableGroupId') {
      const spinner = ora('Environment Variable Groups fetching').start();
      const groups = await getEnvironmentVariableGroups();
      if (!groups || groups.length === 0) {
        spinner.text = 'No environment variable groups available';
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = groups.map((group: any) => ({ name: group.id, message: `${group.id} (${group.name})` }));
      spinner.text = 'Environment Variable Groups fetched';
      spinner.succeed();
    } else if (param.name === 'entVersionId') {
      const spinner = ora('Enterprise Versions fetching').start();
      const profiles = await getEnterpriseAppVersions({ entProfileId: params.entProfileId, publishType: '' });
      if (!profiles || profiles.length === 0) {
        spinner.text = 'No version available';
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = profiles.map((profile: any) => ({ name: profile.id, message: `${profile.version} (${profile.versionCode})` }));
      spinner.text = 'Enterprise Versions fetched';
      spinner.succeed();
    } else if (param.name === 'workflowId') {
      const spinner = ora('Workflows fetching').start();
      const workflows = await getWorkflows({ profileId: params.profileId || '' });
      if (!workflows || workflows.length === 0) {
        spinner.text = 'No workflows available';
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = workflows.map((workflow: any) => ({ name: workflow.id, message: `${workflow.id} (${workflow.workflowName})` }));
      spinner.text = 'Workflows fetched';
      spinner.succeed();
    } else if (param.name === 'configurationId') {
      const spinner = ora('Configurations fetching').start();
      const configurations = await getConfigurations({ profileId: params.profileId || '' });
      if (!configurations || configurations.length === 0) {
        spinner.text = 'No configurations available';
        spinner.fail();
        return;
      }
      //@ts-ignore
      param.params = configurations.map((configurations: any) => ({
        name: configurations.item1.id,
        message: `${configurations.item1.id} (${configurations.item1.configurationName})`,
      }));
      spinner.text = 'Configurations fetched';
      spinner.succeed();
    } else if (param.name === 'organizationId') {
      const spinner = ora('Organizations fetching').start();
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
      spinner.text = 'Organizations fetched';
      spinner.succeed();
    } else if (param.name === 'role') {
      const spinner = ora('Roles fetching').start();
      const userinfo = params.userId ? await getOrganizationUserinfo({ organizationId: params.organizationId, userId: params.userId }): null;
      const roleList = await getRoleList();
      if (!roleList || roleList.length === 0) {
        spinner.text = 'No roles available.';
        spinner.fail();
          return { isError: true };
      }
      param.params = roleList.map((role: any) => ({ name: role.key, message: role.description }));
      if(param.from === 'user' && userinfo?.roles) {
        param.params = param.params.filter((role: any) => userinfo.roles.includes(role.name));
        if(param.params.length === 0) {
          spinner.text = 'No roles for this user.';
          spinner.fail();
          return { isError: true };
        }
      }else if (param.required !== false && userinfo?.roles) {
        param.params = param.params.filter((role: any) => !userinfo.roles.includes(role.name));
        if (userinfo?.roles.includes('owner')) {
          param.params = [{ name: 'owner', message: 'Owner' }];
        }
      }
      spinner.text = 'Roles fetched';
      spinner.succeed();
    } else if (param.name === 'userId' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Users fetching').start();
      let userList = await getOrganizationUsers({ organizationId: params.organizationId || params.currentOrganizationId || '' });
      if (!userList || userList.length === 0) {
        spinner.text = 'No users available';
      }
      if (param.required === false) {
        userList.unshift({ id: UNKNOWN_PARAM_VALUE, _message: ' Skip - (No user)' });
      }
      param.params = userList.map((user: any) => ({ name: user.id, message: user._message || ` ${user.id} (${user.email})` }));
      spinner.text = 'Users fetched';
      spinner.succeed();
    }else if(param.name === 'publishProfileId' && param.type === CommandParameterTypes.SELECT){
      const spinner = ora('Publish Profiles Fetching').start();
      const selectedPlatform = globalVariables["platform"];
      const publishProfiles = await getPublishProfiles({ platform: selectedPlatform });
      param.params = publishProfiles.map((profile:any) => ({name:profile.id, message: ` ${profile.id} (${profile.name}) - ${(OperatingSystems as any)[profile.platformType]}`}));
      spinner.text = 'Publish Profiles Fetched';
      spinner.succeed();
    }else if(param.name === 'appVersionId' && param.type === CommandParameterTypes.SELECT){
      const spinner = ora('App Versions Fetching').start();
      const selectedPlatform = globalVariables["platform"];
      const selectedPublishProfileId = globalVariables["publishProfileId"];
      const appVersions = await getAppVersions({ platform: selectedPlatform, publishProfileId: selectedPublishProfileId });
      if (!appVersions || appVersions.length === 0) {
        spinner.text = 'No app versions available';
        spinner.fail();
      }else {
        param.params = appVersions.map((appVersion:any) => ({name:appVersion.id, message: ` ${appVersion.id} - ${appVersion.name}(${appVersion.version}) ${appVersion.releaseCandidate ? '(Release Candidate)' : ''}`}));
        spinner.text = 'App Versions Fetched';
        spinner.succeed();
      }
    }else if(param.name === 'publishVariableGroupId' && param.type === CommandParameterTypes.SELECT){
      const spinner = ora('Publish Variable Groups Fetching').start();
      const groups = await getPublishVariableGroups();
      if (!groups || groups.length === 0) {
        spinner.text = 'No groups available';
        spinner.fail();
      }else {
        param.params = groups.map((group:any) => ({name:group.id, message: ` ${group.id} (${group.name})`}));
        spinner.text = 'Publish Variable Groups Fetched';
        spinner.succeed();
      }
    }
    else if (param.name === 'email' && param.type === CommandParameterTypes.SELECT) {
      const spinner = ora('Invitations fetching').start();
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
      spinner.text = 'Invitations fetched';
      spinner.succeed();
    }else if (param.name === 'value' && params.isSecret) {
      param.type = CommandParameterTypes.PASSWORD;
    }

    // If has paramType and type  match to selected type
    if (!param.paramType || param.paramType === params.type) {
      // Prompt for parameter
      if ([CommandParameterTypes.STRING, CommandParameterTypes.PASSWORD].includes(param.type)) {
        const stringPrompt = await prompt([
          {
            type: param.type,
            name: param.name,
            message: param.description,
            validate(value) {
              //@ts-ignore
              if (value.length === 0 && param.required !== false) {
                return 'This field is required';
              } else if (['app'].includes(param.name)) {
                return fs.existsSync(value) ? true : 'File not exists';
              }
              return true;
            },
          },
        ]);
        (params as any)[param.name] = (stringPrompt as any)[Object.keys(stringPrompt)[0]];

        // set global variables from selected params
        Object.keys(params).map((key:string) => {
          globalVariables[key] = params[key];
        });
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
        // set global variables from selected params
        Object.keys(params).map((key:string) => {
          globalVariables[key] = params[key];
        });
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
      choices: command.subCommands.map((cmd, index) => {
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
