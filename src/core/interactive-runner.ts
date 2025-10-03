import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import moment from 'moment';
//@ts-ignore https://github.com/enquirer/enquirer/issues/212
import { prompt, Select, AutoComplete, BooleanPrompt, Input, Editor } from 'enquirer';
import { runCommand } from './command-runner';
import { Commands, CommandParameterTypes, CommandType } from './commands';
import { APPCIRCLE_COLOR, OperatingSystems, UNKNOWN_PARAM_VALUE } from '../constant';
import { readEnviromentConfigVariable, EnvironmentVariables } from '../config';
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
  getTokenFromApiKey,
  RoleType,
} from '../services';
import { ProgramCommand, createCommandActionCallback } from '../program';
import os from 'os';
import minimist from 'minimist';
import { AppcircleExitError } from './AppcircleExitError';

// Simple multiline input using readline for copy-paste support
import * as readline from 'readline';

export const getSimpleMultilineInput = async (message: string): Promise<string> => {
  console.log(chalk.cyan('?'), message);

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    let lines: string[] = [];
    let emptyLineCount = 0;

    const onLine = (line: string) => {
      if (line.trim() === '') {
        emptyLineCount++;
        if (emptyLineCount >= 2) {
          // Two empty lines = finish
          rl.close();
          resolve(lines.join('\n').trim());
          return;
        }
      } else {
        emptyLineCount = 0;
      }

      lines.push(line);
    };

    rl.on('line', onLine);
    rl.on('close', () => {
      resolve(lines.join('\n').trim());
    });

    // Handle Ctrl+C gracefully
    rl.on('SIGINT', () => {
      console.log('\nInput cancelled.');
      rl.close();
      resolve('');
    });
  });
};

interface NavigationState {
  command: CommandType;
  preparedCommand?: ProgramCommand;
}

const navigationStack: NavigationState[] = [];
let hasShownLogo = false;

const previousSelections = new Map<string, number>();

export const expandTilde = (filePath: string): string => {
  if (!filePath) return filePath;
  const expandedPath = filePath.replace(/^~/, os.homedir());
  return path.resolve(expandedPath);
};

export const validateFilePathForParam = (value: string, paramName: string): string | boolean => {
  if (value.length === 0) {
    return "This field is required";
  }
  
  if (['app', 'filePath'].includes(paramName)) {
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
};

export const createParameterPromptConfig = (param: any) => {
  const config: any = {
    type: param.type,
    name: param.name,
    message: param.description,
    validate: (value: string) => validateFilePathForParam(value, param.name),
  };

  // Special handling for release notes - use simple multiline input
  if (param.name === 'message' && param.description && param.description.toLowerCase().includes('release notes')) {
    config.isSimpleMultilineInput = true;
    config.message = param.description;
    config.required = param.required;
    config.validate = undefined; // Remove file path validation
  }

  return config;
};

export const processParameterValue = (paramName: string, value: any): any => {
  if (paramName === 'filePath') {
    return expandTilde(value);
  }
  return value;
};

export const handleInteractiveParamsOrArguments = async (
  commandParams: CommandType['params'] | CommandType['arguments'] = []
): Promise<Record<string, any> | undefined> => {
  let params: any = {};
  const buildProfilesList: any[] = [];
  const branchesList: any[] = [];
  const commitsList: any[] = [];
  const configurationsList: any[] = [];
  const workflowsList: any[] = [];
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
        spinner.fail('No branches found for the selected profile');
        return { isError: true };
      }
      branchesList.length = 0;
      branchesList.push(...branches);
      //@ts-ignore
      param.params = branches.map((branch: any) => ({ name: `${branch.name} (${branch.id})`, message: `${branch.name} (${branch.id})` }));
      spinner.stop();

      const messageText = param.description || 'Branch';
      const selectPrompt = new AutoComplete({
        name: param.name,
        message: `${messageText} (${branches.length} options)`,
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
        spinner.fail('No build profiles found');
        return { isError: true };
      }
      buildProfilesList.length = 0;
      buildProfilesList.push(...profiles);
      //@ts-ignore
      param.params = profiles.map((profile: any) => ({ name: `${profile.name} (${profile.id})`, message: `${profile.name} (${profile.id})` }));
      spinner.stop();

      const messageText = param.description || 'Build Profile';
      const selectPrompt = new AutoComplete({
        name: param.name,
        message: `${messageText} (${profiles.length} options)`,
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
        spinner.fail('No commits found for the selected branch');
        return { isError: true };
      }
      commitsList.length = 0;
      commitsList.push(...commits);
      //@ts-ignore
      param.params = commits.map((commit: any, index: number) => {
        let shortMsg = commit.message && commit.message.trim().length > 0
          ? commit.message.substring(0, 20) + (commit.message.length > 20 ? '...' : '')
          : '<no message>';
        shortMsg = JSON.stringify(shortMsg);
        let editedMessage = `${shortMsg} (${commit.id}) ${index === 0 ? ' (latest)' : ''}`
        return { name: editedMessage, message: editedMessage };
      });
      spinner.stop();
      if (!params.commitId || (param.name === 'commitId' && !commitsList.find(c => c.id === params.commitId))) {
        const messageText = param.description || 'Commit Message (ID)';
        const selectPrompt = new AutoComplete({
          name: param.name,
          message: `${messageText} (${commits.length} options)`,
          initial: params.commitId || param.defaultValue,
          limit: 10,
          choices: Array.isArray(param.params) ? param.params : [],
        });
        const selected = await selectPrompt.run();
        const uuidRegex = /\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/;
        const idMatch = uuidRegex.exec(selected);

        if (idMatch && idMatch[1]) {
          params.commitId = idMatch[1].trim();
        } else if (param.required === false) {
          params.commitId = '';
        } else {
          params.commitId = selected;
        }
      }
      continue;
    } else if (param.name === 'buildId') {
      const result = await handleBuildIdParameter(param, params, getBuildsOfCommit);
      if (result.isError) {
        return result;
      }
      params.buildId = result.value;
      continue;
    } else if (param.name === 'entProfileId') {
      const result = await handleEntProfileIdParameter(param, params, getEnterpriseProfiles);
      if (result.isError) {
        return result;
      }
      params.entProfileId = result.value;
      continue;
    } else if (param.name === 'distProfileId') {
      const result = await handleDistProfileIdParameter(param, params, getDistributionProfiles);
      if (result.isError) {
        if (result.errorType === 'throw') {
          throw new AppcircleExitError('No Distribution Profile Available', 1);
        }
        return result;
      }
      params.distProfileId = result.value;
      continue;
    } else if (param.name === 'variableGroupId') {
      const result = await handleVariableGroupIdParameter(param, params, getEnvironmentVariableGroups);
      if (result.isError) {
        return result;
      }
      params.variableGroupId = result.value;
      continue;
    } else if (param.name === 'entVersionId') {
      const result = await handleEntVersionIdParameter(param, params, getEnterpriseAppVersions);
      if (result.isError) {
        return result;
      }
      params.entVersionId = result.value;
      continue;
    } else if (param.name === 'workflowId') {
      const result = await handleWorkflowIdParameter(param, params, workflowsList, getWorkflows);
      if (result.isError) {
        return result;
      }
      params.workflowId = result.value;
      continue;
    } else if (param.name === 'configurationId') {
      const result = await handleConfigurationIdParameter(param, params, getConfigurations, branchesList, configurationsList);
      if (result.isError) {
        return result;
      }
      params.configurationId = result.value;
      if (result.updatedBranchId) {
        params.branchId = result.updatedBranchId;
      }
      continue;
    } else if (param.name === 'organizationId') {
      const result = await handleOrganizationIdParameter(param, params, getUserInfo, getOrganizations);
      if (result.isError) {
        return result;
      }
      params.organizationId = result.value;
      continue;
    } else if (param.name === 'organization-id') {
      // Simple input prompt for organization ID
      const inputPrompt = new Input({
        name: param.name,
        message: 'Organization ID (optional - press Enter to skip):',
        initial: param.defaultValue,
      });
      const selected = await inputPrompt.run();
      if (selected && selected.trim() !== '') {
        params['organization-id'] = selected.trim();
      } else {
        params['organization-id'] = undefined;
      }
      continue;
    } else if (param.name === 'role') {
      const result = await handleRoleParameter(param, params, getRoleList, getOrganizationUserinfo);
      if (result.isError) {
        return result;
      }
      // The role handler modifies the param object directly for compatibility
      continue;
    } else if (param.name === 'userId' && param.type === CommandParameterTypes.SELECT) {
      const result = await handleUserIdParameter(param, params, getOrganizationUsers);
      if (result.isError) {
        return result;
      }
      params.userId = result.value;
      continue;
    } else if (param.name === 'publishProfileId' && param.type === CommandParameterTypes.SELECT) {
      const result = await handlePublishProfileIdParameter(param, params, getPublishProfiles);
      if (result.isError) {
        return { isError: true };
      }
      if (result.value) {
        params.publishProfileId = result.value;
      }
      continue;
    } else if (param.name === 'appVersionId' && param.type === CommandParameterTypes.SELECT) {
      const result = await handleAppVersionIdParameter(param, params, getAppVersions);
      if (result.isError) {
        return { isError: true };
      }
      if (result.value) {
        params.appVersionId = result.value;
      }
      continue;
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

        const messageText = param.description || 'Publish Variable Group';
        // Prompt for selection and always extract UUID
        const selectPrompt = new AutoComplete({
          name: param.name,
          message: `${messageText} (${groups.length} options)`,
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
    } else if (param.name === 'email' && param.type === CommandParameterTypes.SELECT) {
      const result = await handleEmailParameter(param, params, getOrganizationInvitations);
      if (result.isError) {
        return { _AC_INTERACTIVE_HALT_: true };
      }

    } else if (param.name === 'value' && params.isSecret) {
      param.type = CommandParameterTypes.PASSWORD;
    } else if (param.name === 'countryCode' && param.type === CommandParameterTypes.SELECT) {
      const result = await handleCountryCodeParameter(param, () => Promise.resolve(getCountries()));
      if (result.isError) {
        return { isError: true };
      }
    } else if (param.name === 'certificateBundleId' && param.type === CommandParameterTypes.SELECT) {
      const result = await handleCertificateBundleIdParameter(param, params, getiOSP12Certificates);
      if (result.isError) {
        return { isError: true };
      }
      if (result.value) {
        params.certificateBundleId = result.value;
      }
      continue;
    } else if (param.name === 'certificateId' && param.type === CommandParameterTypes.SELECT) {
      const result = await handleCertificateIdParameter(param, params, getiOSP12Certificates, getiOSCSRCertificates);
      if (result.isError) {
        return { isError: true };
      }
      if (result.value) {
        params.certificateId = result.value;
      }
      continue;
    } else if (param.name === 'keystoreId' && param.type === CommandParameterTypes.SELECT) {
      const result = await handleKeystoreIdParameter(param, params, getAndroidKeystores);
      if (result.isError) {
        return { isError: true };
      }
      if (result.value) {
        params.keystoreId = result.value;
      }
      continue;
    } else if (param.name === 'provisioningProfileId' && param.type === CommandParameterTypes.SELECT) {
      const result = await handleProvisioningProfileIdParameter(param, params, getProvisioningProfiles);
      if (result.isError) {
        return { isError: true };
      }
      if (result.value) {
        params.provisioningProfileId = result.value;
      }
      continue;
    } else if (param.name === 'testingGroupIds' && param.type === CommandParameterTypes.MULTIPLE_SELECT) {
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
    } else if (param.name === 'testingGroupId' && param.type === CommandParameterTypes.SELECT) {
      const result = await handleTestingGroupIdParameter(param, params, getTestingGroups);
      if (result.isError) {
        return { isError: true };
      }
      if (result.value) {
        params.testingGroupId = result.value;
      }
      continue;
    } else if (param.name === 'testerEmail' && param.type === CommandParameterTypes.SELECT) {
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
        const promptConfig = createParameterPromptConfig(param);
        if (param.required === false && promptConfig.validate) {
          // Modify validation for optional parameters
          const originalValidate = promptConfig.validate;
          promptConfig.validate = (value: string) => {
            if (value.length === 0) return true; // Allow empty for optional
            return originalValidate(value);
          };
        }
        
        // Special handling for simple multiline release notes input
        if ((promptConfig as any).isSimpleMultilineInput) {
          let value = await getSimpleMultilineInput(promptConfig.message);
          value = processParameterValue(param.name, value);
          (params as any)[param.name] = value;
        } else {
          const stringPrompt = await prompt([promptConfig]);
          let value = (stringPrompt as any)[Object.keys(stringPrompt)[0]];
          value = processParameterValue(param.name, value);
          (params as any)[param.name] = value;
        }
      } else if (param.type === CommandParameterTypes.BOOLEAN) {
        // Skip boolean prompts for parameters that should be skipped in interactive mode
        if (param.skipForInteractiveMode) {
          params[param.name] = param.defaultValue || false;
        } else {
          const booleanPrompt = new BooleanPrompt({
            name: param.name,
            message: param.description,
          });
          //@ts-ignore
          params[param.name] = await booleanPrompt.run();
        }
      } else if (param.type === CommandParameterTypes.SELECT && param.params) {
        const selectPrompt = new AutoComplete({
          name: param.name,
          message: `${param.description} (${param.params.length} options)`,
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
          message: `${param.description} (${param.params.length} options) (Multiple selection with 'space')`,
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
    const selectedConfigWrapper = configurationsList.find(
      (cWrapper) =>
        cWrapper.item1.id === params.configurationId ||
        cWrapper.item1.configurationName === params.configurationId ||
        `${cWrapper.item1.configurationName} (${cWrapper.item1.id})` === params.configurationId
    );
    if (selectedConfigWrapper) {
      params.configurationId = selectedConfigWrapper.item1.id;
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

// Step 1: Guard function that returns true when halt or error condition is met
export const isHaltOrError = (result: any): boolean => {
  return result && (result._AC_INTERACTIVE_HALT_ || result.isError);
};

// Step 2: Function to get interactive values with dependency injection for testability
export const getInteractiveValues = async (
  items: CommandType['params'] | CommandType['arguments'],
  run = handleInteractiveParamsOrArguments
): Promise<Record<string, any> | undefined> => {
  const result = await run(items || []);
  if (isHaltOrError(result)) {
    return undefined; // Signal to upper layer to halt
  }
  return result || {};
};

// Step 3: Pure builder function for createCommandActionCallback input
export const buildActionCallbackInput = (
  selectedCommand: CommandType,
  parentCommand: any,
  params: Record<string, any>,
  args: Record<string, any>
) => {
  return {
    parent: parentCommand || null,
    name: () => selectedCommand.command,
    opts: () => params,
    args: () => Object.values(args),
  };
};

// Step 4: Refactored main function using the helpers
export const handleCommandParamsAndArguments = async (selectedCommand: CommandType, parentCommand: any): Promise<ProgramCommand | undefined> => {
  // Get parameters interactively, return undefined if halt/error
  const params = await getInteractiveValues(selectedCommand.params);
  if (params === undefined) {
    return undefined;
  }

  // Get arguments interactively, return undefined if halt/error  
  const args = await getInteractiveValues(selectedCommand.arguments);
  if (args === undefined) {
    return undefined;
  }

  // Build callback input and create command
  const callbackInput = buildActionCallbackInput(selectedCommand, parentCommand, params, args);
  return createCommandActionCallback(callbackInput);
};

// Step 1: Pure function to filter available commands
export const getAvailableChoices = (command: CommandType): CommandType[] => {
  return command.subCommands?.filter((cmd) => !cmd.ignore && !cmd.hidden) || [];
};

// Step 2: Pure function to check if should execute single command directly
export const shouldExecuteSingleCommand = (availableChoices: CommandType[]): boolean => {
  return availableChoices.length === 1;
};

// Step 3: Pure function to build menu choices from commands
export const buildMenuChoices = (availableChoices: CommandType[]): Array<{ name: string; message: string }> => {
  return availableChoices.map((cmd, index) => ({
    name: `${index + 1}. ${cmd.description}`,
    message: `${index + 1}. ${cmd.description}`
  }));
};

// Step 4: Pure function to determine back button text
export const getBackButtonText = (navigationStackLength: number): string => {
  const isTopLevelDirectCommand = process.argv.length > 2 && 
    ['-i', '--interactive'].every(flag => !process.argv.includes(flag));
  return navigationStackLength === 1 && isTopLevelDirectCommand ? '⬅ Exit' : '⬅ Back';
};

// Step 5: Pure function to add back button if needed
export const addBackButtonIfNeeded = (
  choices: Array<{ name: string; message: string }>, 
  navigationStackLength: number
): Array<{ name: string; message: string }> => {
  if (navigationStackLength > 0) {
    const backText = getBackButtonText(navigationStackLength);
    return [
      ...choices,
      { name: 'back', message: backText }
    ];
  }
  return choices;
};

// Step 6: Function to create command selector with DI for testability
export const createCommandSelector = (
  choices: Array<{ name: string; message: string }>,
  commandDescription: string,
  createSelector = (config: any) => new AutoComplete(config)
) => {
  return createSelector({
    name: 'action',
    limit: 10,
    message: `Which sub-command of "${commandDescription}" do you want to run?`,
    choices: choices,
  });
};

// Step 7: Pure function to extract command index from selection
export const parseCommandIndex = (selectedActionName: string): number => {
  return parseInt(selectedActionName.split('.')[0]) - 1;
};

// Step 8: Function to handle back navigation with DI for stack manipulation
export const handleBackNavigation = async (
  handleSelectedCommandFn: typeof handleSelectedCommand,
  stackPop = () => navigationStack.pop(),
  getStackLength = () => navigationStack.length,
  getLastStackItem = () => navigationStack[navigationStack.length - 1]
): Promise<ProgramCommand | undefined> => {
  stackPop();
  if (getStackLength() === 0) {
    return { isBackToMainMenu: true } as any;
  }
  
  const parentCommand = getLastStackItem();
  return await handleSelectedCommandFn(parentCommand.command, parentCommand.preparedCommand);
};

// Step 9: Function to handle forward navigation with DI for stack manipulation
export const handleForwardNavigation = async (
  selectedCommand: CommandType,
  preparedCommand: ProgramCommand | undefined,
  handleSelectedCommandFn: typeof handleSelectedCommand,
  stackPush = (item: NavigationState) => navigationStack.push(item)
): Promise<ProgramCommand | undefined> => {
  stackPush({ command: selectedCommand, preparedCommand });
  return await handleSelectedCommandFn(selectedCommand, preparedCommand);
};

// Step 10: Refactored main function using the helpers
export const handleSelectedCommand = async (command: CommandType, __parentCommand?: any): Promise<ProgramCommand | undefined> => {
  // Step 1: Prepare command parameters and arguments
  const preparedCommand = await handleCommandParamsAndArguments(command, __parentCommand);
  
  // Step 2: Check if command has subcommands
  if (!command.subCommands?.length) {
    return preparedCommand;
  }

  // Step 3: Get available choices
  const availableChoices = getAvailableChoices(command);

  // Step 4: If single command, execute directly
  if (shouldExecuteSingleCommand(availableChoices)) {
    return await handleSelectedCommand(availableChoices[0], preparedCommand);
  }

  // Step 5: Build menu choices
  let choices = buildMenuChoices(availableChoices);
  choices = addBackButtonIfNeeded(choices, navigationStack.length);

  // Step 6: Create and run command selector
  const commandSelect = createCommandSelector(choices, command.description);
  const selectedActionName = await commandSelect.run();

  // Step 7: Handle back navigation
  if (selectedActionName === 'back') {
    return await handleBackNavigation(handleSelectedCommand);
  }

  // Step 8: Handle forward navigation
  const commandIndex = parseCommandIndex(selectedActionName);
  const selectedCommand = availableChoices[commandIndex];
  if (selectedCommand) {
    return await handleForwardNavigation(selectedCommand, preparedCommand, handleSelectedCommand);
  }

  // This should never be reached, but return undefined for type safety
  return undefined;
};

// Helper functions for parameter handling - reusable across different parameter types
export const extractIdFromSelection = (selection: string): string => {
  if (!selection || selection.trim() === '') return '';
  
  const trimmed = selection.trim();
  
  // Handle format "Name (ID)" first - look for parentheses anywhere
  const parenMatch = trimmed.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1].trim() !== '') {
    return parenMatch[1].trim();
  }
  
  // Handle format "ID - Name" - match everything before " - " (space-dash-space)
  const dashMatch = trimmed.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch && dashMatch[1].trim() !== '' && dashMatch[2].trim() !== '') {
    return dashMatch[1].trim();
  }
  
  // Handle format "ID: Name" - only if there's actually content after the colon
  const colonMatch = trimmed.match(/^([^:]+):(.+)$/);
  if (colonMatch && colonMatch[1].trim() !== '' && colonMatch[2].trim() !== '') {
    return colonMatch[1].trim();
  }
  
  return trimmed;
};

export const createSpinnerWithErrorHandling = (
  message: string,
  oraSpinner = ora
) => {
  const spinner = oraSpinner(message).start();
  
  const failWithMessage = (errorMessage: string) => {
    spinner.text = errorMessage;
    spinner.fail();
  };
  
  const stopSpinner = () => {
    spinner.stop();
  };
  
  return { spinner, failWithMessage, stopSpinner };
};

export const extractUuidFromText = (text: string): string | null => {
  const uuidRegex = /\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/;
  const match = uuidRegex.exec(text);
  return match && match[1] ? match[1].trim() : null;
};

export const processSelectedItemId = (
  selected: string,
  items: any[],
  idField: string = 'id'
): string => {
  // First try UUID extraction
  const extractedUuid = extractUuidFromText(selected);
  if (extractedUuid) {
    return extractedUuid;
  }
  
  // Then try general ID extraction
  const extractedId = extractIdFromSelection(selected);
  
  // Validate against actual items
  const found = items.find((item: any) => 
    item[idField] === extractedId || 
    item[idField] === selected ||
    `${item.name} (${item[idField]})` === selected
  );
  
  return found ? found[idField] : extractedId;
};

export const createAutoCompletePrompt = (
  name: string,
  message: string,
  choices: string[],
  limit: number = 10
): any => {
  const { AutoComplete } = require('enquirer');
  return new AutoComplete({
    name,
    message,
    choices,
    limit,
  });
};

export const formatChoicesWithId = (items: any[], idField: string, nameField?: string): string[] => {
  if (!Array.isArray(items) || items.length === 0) return [];
  
  return items.map(item => {
    const id = item[idField];
    const name = nameField ? item[nameField] : item.name || item.displayName || item.title || '';
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    return trimmedName ? `${id} - ${trimmedName}` : id.toString();
  });
};

export const validateParameterInput = (value: any, parameterName: string): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
};

// Parameter handler functions - extracted from handleInteractiveParamsOrArguments
export const handleBranchIdParameter = async (
  param: any,
  params: any,
  buildProfilesList: any[],
  branchesList: any[],
  getBranches: (options: { profileId: string }) => Promise<{ branches: any[] }>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Branches...').start();
  
  // Handle profileId extraction if needed
  if (params.profileId && buildProfilesList.length > 0) {
    const extractedProfileId = extractIdFromSelection(params.profileId);
    const selectedProfile = buildProfilesList.find((p) => p.id === extractedProfileId);
    if (selectedProfile) {
      params.profileId = selectedProfile.id;
    }
  }
  
  // Handle existing branchId extraction if needed
  if (params.branchId && branchesList.length > 0) {
    const extractedBranchId = extractIdFromSelection(params.branchId);
    const selectedBranch = branchesList.find((b) => b.id === extractedBranchId);
    if (selectedBranch) {
      params.branchId = selectedBranch.id;
    }
  }
  
  try {
    const branches = (await getBranches({ profileId: params.profileId || '' })).branches;
    
    if (!branches || branches.length === 0) {
      spinner.fail('No branches found for the selected profile');
      return { isError: true };
    }
    
    // Update branches list
    branchesList.length = 0;
    branchesList.push(...branches);
    
    // Format choices
    const choices = formatChoicesWithId(branches, 'id', 'name');
    
    spinner.stop();
    
    const messageText = param.description || 'Branch';
    const selectPrompt = createPrompt(
      param.name,
      `${messageText} (${branches.length} options)`,
      choices
    );
    
    const selected = await selectPrompt.run();
    const extractedId = extractIdFromSelection(selected);
    
    // Validate selection
    const foundBranch = branches.find((b) => b.id === extractedId);
    return { value: foundBranch ? foundBranch.id : extractedId };
    
  } catch (error) {
    spinner.fail(`Failed to fetch branches: ${error}`);
    return { isError: true };
  }
};

export const handleProfileIdParameter = async (
  param: any,
  buildProfilesList: any[],
  getBuildProfiles: () => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Build Profiles...').start();
  
  try {
    const profiles = await getBuildProfiles();
    
    if (!profiles || profiles.length === 0) {
      spinner.fail('No build profiles found');
      return { isError: true };
    }
    
    // Update build profiles list
    buildProfilesList.length = 0;
    buildProfilesList.push(...profiles);
    
    // Format choices
    const choices = formatChoicesWithId(profiles, 'id', 'name');
    
    spinner.stop();
    
    const messageText = param.description || 'Build Profile';
    const selectPrompt = createPrompt(
      param.name,
      `${messageText} (${profiles.length} options)`,
      choices
    );
    
    const selected = await selectPrompt.run();
    const extractedId = extractIdFromSelection(selected);
    
    // Validate selection
    const foundProfile = profiles.find((p) => p.id === extractedId);
    return { value: foundProfile ? foundProfile.id : extractedId };
    
  } catch (error) {
    spinner.fail(`Failed to fetch build profiles: ${error}`);
    return { isError: true };
  }
};

export const handleCommitIdParameter = async (
  param: any,
  params: any,
  branchesList: any[],
  commitsList: any[],
  getCommits: (options: { profileId: string; branchId: string }) => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Commits...').start();
  
  try {
    // Handle branchId extraction if needed
    if (params.branchId && branchesList.length > 0) {
      const extractedBranchId = extractIdFromSelection(params.branchId);
      const selectedBranch = branchesList.find((b) => b.id === extractedBranchId);
      if (selectedBranch) {
        params.branchId = selectedBranch.id;
      }
    }
    
    // Handle existing commitId extraction if needed
    if (params.commitId && commitsList.length > 0) {
      const extractedCommitId = extractIdFromSelection(params.commitId);
      const selectedCommit = commitsList.find((c) => c.id === extractedCommitId);
      if (selectedCommit) {
        params.commitId = selectedCommit.id;
      }
    }
    
    const commits = await getCommits({ 
      profileId: params.profileId || '', 
      branchId: params.branchId || '' 
    });
    
    if (!commits || commits.length === 0) {
      spinner.fail('No commits found for the selected branch');
      return { isError: true };
    }
    
    // Update commits list
    commitsList.length = 0;
    commitsList.push(...commits);
    
    spinner.stop();
    
    // Check if we already have a valid commitId
    if (params.commitId && commitsList.find(c => c.id === params.commitId)) {
      return { value: params.commitId };
    }
    
    // Format choices with commit messages
    const choices = commits.map((commit: any, index: number) => {
      let shortMsg = commit.message && commit.message.trim().length > 0
        ? commit.message.substring(0, 20) + (commit.message.length > 20 ? '...' : '')
        : '<no message>';
      shortMsg = JSON.stringify(shortMsg);
      const latestTag = index === 0 ? ' (latest)' : '';
      return `${shortMsg} (${commit.id})${latestTag}`;
    });
    
    const messageText = param.description || 'Commit Message (ID)';
    const selectPrompt = createPrompt(
      param.name,
      `${messageText} (${commits.length} options)`,
      choices
    );
    
    const selected = await selectPrompt.run();
    
    // Extract UUID from selection using specific UUID regex
    const uuidRegex = /\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/;
    const idMatch = uuidRegex.exec(selected);
    
    if (idMatch && idMatch[1]) {
      return { value: idMatch[1].trim() };
    } else if (param.required === false) {
      return { value: '' };
    } else {
      return { value: selected };
    }
    
  } catch (error) {
    spinner.fail(`Failed to fetch commits: ${error}`);
    return { isError: true };
  }
};

/**
 * Handles buildId parameter selection
 * Extracts commit ID, fetches builds, and allows user selection
 */
export const handleBuildIdParameter = async (
  param: any,
  params: any,
  getBuildsOfCommit: (options: { commitId: string }) => Promise<any>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Builds...').start();
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
    spinner.fail('Failed to fetch builds for the selected commit');
    return { isError: true };
  }
  if (!builds || builds.length === 0) {
    spinner.fail('No builds found for the selected commit');
    return { isError: true };
  }
  spinner.stop();
  
  const choices = builds.map((build: any) => {
    const dateStr = build.startDate ? moment(build.startDate).format('YYYY-MM-DD HH:mm') : '-';
    return `${build.id} (${dateStr})`;
  });
  
  const messageText = param.description || 'Build ID';
  const selectPrompt = createPrompt(param.name, `${messageText} (${builds.length} options)`, choices, 10);
  const selected = await selectPrompt.run();
  
  const match = /^([0-9a-fA-F-]{36})/.exec(selected);
  if (match && match[1]) {
    return { value: match[1].trim() };
  } else {
    return { value: selected };
  }
};

/**
 * Handles workflowId parameter selection
 * Manages existing workflowId extraction, fetches workflows, and allows user selection with latest workflow marking
 */
export const handleWorkflowIdParameter = async (
  param: any,
  params: any,
  workflowsList: any[],
  getWorkflows: (options: { profileId: string }) => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Workflows...').start();
  
  if (params.workflowId) {
    const match = /\(([^)]+)\)$/.exec(params.workflowId);
    const selectedWorkflowId = match ? match[1] : params.workflowId;
    params.workflowId = selectedWorkflowId;
  }
  
  const workflows = await getWorkflows({ profileId: params.profileId || '' });
  if (!workflows || workflows.length === 0) {
    spinner.text = 'No workflows available';
    spinner.fail();
    return { isError: true };
  }
  
  workflowsList.length = 0;
  workflowsList.push(...workflows);
  
  const choices = workflows.map((workflow: any, index: number) => {
    const latestTag = index === 0 ? ' (latest)' : '';
    return `${workflow.workflowName} (${workflow.id})${latestTag}`;
  });
  
  spinner.stop();
  
  const messageText = param.description || 'Workflow Name (ID)';
  const selectPrompt = createPrompt(param.name, `${messageText} (${workflows.length} options)`, choices, 10);
  const selected = await selectPrompt.run();
  
  const uuidRegex = /\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/;
  const idMatch = uuidRegex.exec(selected);
  
  if (idMatch && idMatch[1]) {
    return { value: idMatch[1].trim() };
  } else {
    return { value: selected };
  }
};

/**
 * Handles organizationId parameter selection
 * Manages user info fetching, organization filtering, and special "all" organizations logic
 */
export const handleOrganizationIdParameter = async (
  param: any,
  params: any,
  getUserInfo: () => Promise<any>,
  getOrganizations: () => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Organizations...').start();
  const isAllOrganizations = param.defaultValue === 'all';
  const userInfo = await getUserInfo();
  const organizations = await getOrganizations();
  
  if (!organizations || organizations.length === 0) {
    spinner.text = 'No organizations available';
    spinner.fail();
    return { isError: true };
  }
  
  param.defaultValue = param.defaultValue || 'all';
  const currentOrganization = organizations.find((org: any) => org.id === userInfo.currentOrganizationId);
  
  const organizationParams = (
    isAllOrganizations
      ? []
      : [{ name: `${currentOrganization?.name?.trim() || 'Unknown'} (${userInfo.currentOrganizationId})`, message: `${currentOrganization?.name?.trim() || 'Unknown'} (${userInfo.currentOrganizationId})` }]
  ).concat(
    organizations
      .filter((org: any) => isAllOrganizations || (org.rootOrganizationId === currentOrganization?.id))
      .map((organization: any) => ({
        name: `${organization.name?.trim() || 'Unknown'} (${organization.id || 'undefined'})`,
        message: `${organization.name?.trim() || 'Unknown'} (${organization.id || 'undefined'})`,
      }))
  );
  
  const choices = (isAllOrganizations ? [{ name: 'all', message: `All Organizations` }] : [])
    .concat(organizationParams)
    .map((item: any) => item.name);
  
  params['currentOrganizationId'] = userInfo.currentOrganizationId;
  spinner.stop();

  const messageText = param.description || 'Organization';
  const selectPrompt = createPrompt(param.name, `${messageText} (${choices.length} options)`, choices, 10);
  const selected = await selectPrompt.run();
  
  if (selected === 'all') {
    return { value: 'all' };
  } else {
    const match = /\(([^)]+)\)$/.exec(selected);
    if (match && match[1]) {
      return { value: match[1].trim() };
    } else {
      // fallback: try to find by name
      const found = organizations.find((o: any) => `${o.name} (${o.id})` === selected || o.id === selected);
      return { value: found ? found.id : selected };
    }
  }
};

/**
 * Handles distProfileId parameter selection
 * Fetches distribution profiles and allows user selection with UUID extraction and fallback logic
 */
export const handleDistProfileIdParameter = async (
  param: any,
  params: any,
  getDistributionProfiles: () => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean; errorType?: 'throw' }> => {
  const spinner = oraSpinner('Listing Distribution Profiles...').start();
  const profiles = await getDistributionProfiles();
  
  if (!profiles || profiles.length === 0) {
    spinner.text = 'No Distribution Profile Available';
    spinner.fail();
    return { isError: true, errorType: 'throw' };
  }
  
  const choices = profiles.map((profile: any) => `${profile.name} (${profile.id})`);
  spinner.stop();

  const messageText = param.description || 'Distribution Profile';
  const selectPrompt = createPrompt(param.name, `${messageText} (${profiles.length} options)`, choices, 10);
  const selected = await selectPrompt.run();
  
  // Extract the UUID from the last parentheses in the new format "Name (UUID)"
  const match = /\(([^)]+)\)\s*$/.exec(selected);
  if (match && match[1]) {
    return { value: match[1].trim() };
  } else {
    // fallback: try to find by id
    const found = profiles.find((profile: any) => selected.includes(profile.id));
    return { value: found ? found.id : selected };
  }
};

/**
 * Handles variableGroupId parameter selection
 * Fetches environment variable groups and allows user selection with UUID extraction and fallback logic
 */
export const handleVariableGroupIdParameter = async (
  param: any,
  params: any,
  getEnvironmentVariableGroups: () => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Environment Variable Groups...').start();
  const groups = await getEnvironmentVariableGroups();
  
  if (!groups || groups.length === 0) {
    spinner.text = 'No Environment Variable Groups Available';
    spinner.fail();
    return { isError: true };
  }
  
  const choices = groups.map((group: any) => `${group.name} (${group.id})`);
  spinner.stop();

  const messageText = param.description || 'Variable Group';
  const selectPrompt = createPrompt(param.name, `${messageText} (${groups.length} options)`, choices, 10);
  const selected = await selectPrompt.run();
  
  const match = /\(([^)]+)\)$/.exec(selected);
  if (match && match[1]) {
    return { value: match[1].trim() };
  } else {
    // fallback: try to find by name
    const found = groups.find((g: any) => `${g.name} (${g.id})` === selected || g.id === selected);
    return { value: found ? found.id : selected };
  }
};

/**
 * Handles entProfileId parameter selection
 * Fetches enterprise profiles and allows user selection with UUID extraction and fallback logic
 */
export const handleEntProfileIdParameter = async (
  param: any,
  params: any,
  getEnterpriseProfiles: () => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Enterprise Profiles...').start();
  const profiles = await getEnterpriseProfiles();
  
  if (!profiles || profiles.length === 0) {
    spinner.text = 'No enterprise profile available';
    spinner.fail();
    return { isError: true };
  }
  
  // Use Name (ID) format for both name and message
  const choices = profiles.map((profile: any) => ({ name: `${profile.name} (${profile.id})`, message: `${profile.name} (${profile.id})` }));
  spinner.stop();
  
  const messageText = param.description || 'Enterprise Profile';
  // Prompt for selection and always extract UUID
  const selectPrompt = createPrompt(param.name, `${messageText} (${profiles.length} options)`, choices.map((c: any) => c.name), 10);
  const selected = await selectPrompt.run();
  const match = /\(([^)]+)\)$/.exec(selected);
  if (match && match[1]) {
    return { value: match[1].trim() };
  } else {
    // fallback: try to find by name
    const found = profiles.find((p: any) => `${p.name} (${p.id})` === selected || p.id === selected);
    return { value: found ? found.id : selected };
  }
};

/**
 * Handles entVersionId parameter selection
 * Fetches enterprise app versions and allows user selection with ID extraction
 */
export const handleEntVersionIdParameter = async (
  param: any,
  params: any,
  getEnterpriseAppVersions: (options: { entProfileId: string; publishType: string }) => Promise<any>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Enterprise Versions...').start();
  const profiles = await getEnterpriseAppVersions({ entProfileId: params.entProfileId, publishType: '' });
  
  if (!profiles || profiles.length === 0) {
    spinner.text = 'No version available';
    spinner.fail();
    return { isError: true };
  }
  
  const versionMap = new Map(profiles.map((profile: any) => [profile.id, `${profile.version} (${profile.versionCode}) (${profile.id})`]));
  const choices = profiles.map((profile: any) => ({ 
    name: versionMap.get(profile.id), 
    message: `${profile.version} (${profile.versionCode}) (${profile.id})` 
  }));
  spinner.stop();
  
  const messageText = param.description || 'App Version ID';
  const selectPrompt = createPrompt(param.name, `${messageText} (${profiles.length} options)`, choices.map((c: any) => c.name), 10);
  const selected = await selectPrompt.run();
  const match = /\(([\w-]+)\)$/.exec(selected);
  if (match && match[1]) {
    return { value: match[1].trim() };
  } else {
    return { value: selected };
  }
};

/**
 * Handles configurationId parameter selection
 * Complex handler that manages branch ID resolution, configuration caching, and selection
 */
export const handleConfigurationIdParameter = async (
  param: any,
  params: any,
  getConfigurations: (options: { profileId: string }) => Promise<any[]>,
  branchesList: any[] = [],
  configurationsList: any[] = [],
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean; updatedBranchId?: string }> => {
  const spinner = oraSpinner('Listing Configurations...').start();
  let updatedBranchId: string | undefined;
  
  // Handle branchId resolution if needed
  if (params.branchId && branchesList.length > 0) {
    const match = /\(([^)]+)\)$/.exec(params.branchId);
    const selectedBranchId = match ? match[1] : params.branchId;
    const selectedBranch = branchesList.find((b: any) => b.id === selectedBranchId);
    if (selectedBranch) {
      updatedBranchId = selectedBranch.id;
    }
  }
  
  // Handle existing configurationId resolution if available
  if (params.configurationId && configurationsList.length > 0) {
    const selectedConfigWrapper = configurationsList.find(
      (cWrapper: any) =>
        cWrapper.item1.id === params.configurationId ||
        cWrapper.item1.configurationName === params.configurationId ||
        `${cWrapper.item1.configurationName} (${cWrapper.item1.id})` === params.configurationId
    );
    if (selectedConfigWrapper) {
      spinner.stop();
      return { value: selectedConfigWrapper.item1.id, updatedBranchId };
    }
  }
  
  // Fetch fresh configurations
  const configurations = await getConfigurations({ profileId: params.profileId || '' });
  if (!configurations || configurations.length === 0) {
    spinner.text = 'No configurations available';
    spinner.fail();
    return { isError: true };
  }
  
  // Update global configurationsList cache
  configurationsList.length = 0;
  configurationsList.push(...configurations);
  
  // Create choices with latest indicator
  const choices = configurations.map((configWrapper: any, index: number) => ({
    name: `${configWrapper?.item1?.configurationName || 'Unknown'} (${configWrapper?.item1?.id || 'unknown-id'})${index === 0 ? ' (latest)' : ''}`,
    message: `${configWrapper?.item1?.configurationName || 'Unknown'} (${configWrapper?.item1?.id || 'unknown-id'})${index === 0 ? ' (latest)' : ''}`
  }));
  
  spinner.stop();
  
  const messageText = param.description || 'Configuration Name (ID)';
  const selectPrompt = createPrompt(param.name, `${messageText} (${configurations.length} options)`, choices.map((c: any) => c.name), 10);
  const selected = await selectPrompt.run();
  
  // Extract UUID using specific regex
  const uuidRegex = /\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/;
  const idMatch = uuidRegex.exec(selected);
  
  if (idMatch && idMatch[1]) {
    return { value: idMatch[1].trim(), updatedBranchId };
  } else if (param.required === false) {
    return { value: '', updatedBranchId };
  } else {
    return { value: selected, updatedBranchId };
  }
};

/**
 * Handles role parameter selection
 * Complex handler that manages role filtering based on user context and auto-fill logic
 */
export const handleRoleParameter = async (
  param: any,
  params: any,
  getRoleList: () => Promise<RoleType[]>,
  getOrganizationUserinfo: (options: { organizationId: string; userId: string }) => Promise<any>,
  oraSpinner = ora
): Promise<{ isError?: boolean }> => {
  const spinner = oraSpinner('Listing Roles...').start();
  
  // Get user info if userId is available
  const userinfo = params.userId ? await getOrganizationUserinfo({ 
    organizationId: params.organizationId, 
    userId: params.userId 
  }) : null;
  
  // Get role list
  const roleList = await getRoleList();
  if (!roleList || roleList.length === 0) {
    spinner.text = 'No roles available.';
    spinner.fail();
    return { isError: true };
  }
  
  // Set base param choices
  param.params = roleList.map((role: RoleType) => ({ 
    name: role?.key, 
    message: role?.description 
  }));
  
  // Handle auto-fill for interactive mode
  if (param.autoFillForInteractiveMode) {
    param.defaultValue = [];
    roleList.forEach((role: RoleType, index: number) => {
      if (role?.isDefaultRole) {
        param.defaultValue.push(index);
      }
    });
  }
  
  // Handle role filtering based on context
  if (param.from === 'user' && userinfo?.roles) {
    // Filter to only roles this user has
    param.params = param.params.filter((role: any) => 
      userinfo.roles.includes(role.name)
    );
    
    if (param.params.length === 0) {
      spinner.text = 'No roles for this user.';
      spinner.fail();
      return { isError: true };
    }
  } else if (param.required !== false && userinfo?.roles) {
    // Filter to exclude roles this user already has
    param.params = param.params.filter((role: any) => 
      !userinfo.roles.includes(role.name)
    );
    
    // Special case: if user is owner, only show owner role
    if (userinfo.roles.includes('owner')) {
      param.params = [{ name: 'owner', message: 'Owner' }];
    }
  }
  
  spinner.stop();
  return {};
};

/**
 * Handles userId parameter selection
 * Fetches organization users and allows selection with email (ID) format and optional skip
 */
export const handleUserIdParameter = async (
  param: any,
  params: any,
  getOrganizationUsers: (options: { organizationId: string }) => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Users...').start();
  
  let userList: any[] = [];
  try {
    // Get organization users
    userList = await getOrganizationUsers({ 
      organizationId: params.organizationId || params.currentOrganizationId || '' 
    });
  } catch (error) {
    spinner.text = 'Fetching users failed';
    spinner.fail();
    return { isError: true };
  }
  
  // Handle null/undefined userList gracefully
  if (!userList) {
    if (param.required === false) {
      spinner.stop();
      return { value: UNKNOWN_PARAM_VALUE };
    } else {
      spinner.text = 'No users in this organization';
      spinner.fail();
      return { isError: true };
    }
  }
  
  // Add skip option if parameter is not required
  if (param.required === false) {
    userList = userList || [];
    userList.unshift({ 
      id: UNKNOWN_PARAM_VALUE, 
      email: UNKNOWN_PARAM_VALUE,
      _message: ' Skip - (No user)' 
    });
  }
  
  // Format user selection as email (id) with safe property access
  const choices = userList.map((user: any) => ({ 
    name: user?._message || `${user?.email || 'Unknown'} (${user?.id || 'unknown-id'})`, 
    message: user?._message || `${user?.email || 'Unknown'} (${user?.id || 'unknown-id'})` 
  }));
  
  if (!choices?.length) {
    spinner.text = "No users in this organization";
    spinner.fail();
    return { isError: true };
  }
  
  spinner.stop();
  
  // Prompt for selection and always extract ID
  const messageText = param.description || 'User';
  const selectPrompt = createPrompt(param.name, `${messageText} (${userList.length} options)`, choices.map((c: any) => c.name), 10);
  const selected = await selectPrompt.run();
  
  // Check if skip option was selected first
  const found = userList.find((u: any) => 
    (u?._message && u._message === selected) ||
    `${u?.email} (${u?.id})` === selected || 
    u?.id === selected
  );
  
  if (found) {
    return { value: found.id };
  }
  
  // Extract ID from parentheses format as fallback
  const match = /\(([^)]+)\)$/.exec(selected);
  if (match && match[1]) {
    return { value: match[1].trim() };
  } else {
    return { value: selected };
  }
};

export const handleEmailParameter = async (
  param: any,
  params: any,
  getOrganizationInvitations: (options: { organizationId: string }) => Promise<any[]>,
  oraSpinner = ora
): Promise<{ isError?: boolean }> => {
  const spinner = oraSpinner('Listing Invitations...').start();
  
  let invitationsList: any[] = [];
  try {
    invitationsList = await getOrganizationInvitations({ 
      organizationId: params.organizationId || params.currentOrganizationId || '' 
    });
  } catch (error) {
    spinner.text = 'Fetching invitations failed';
    spinner.fail();
    return { isError: true };
  }
  
  if (param.required !== false && (!invitationsList || invitationsList.length === 0)) {
    spinner.text = 'No invitations available';
    spinner.fail();
    return { isError: true };
  }
  
  // Add skip option if parameter is not required
  if (param.required === false) {
    invitationsList = invitationsList || [];
    invitationsList.unshift({ 
      userEmail: UNKNOWN_PARAM_VALUE, 
      _message: 'Skip - (No email)' 
    });
  }
  
  // Format invitation selection with safe property access
  param.params = invitationsList.map((invitation: any) => ({ 
    name: invitation?.userEmail, 
    message: invitation?._message || invitation?.userEmail 
  }));
  
  spinner.stop();
  return {};
};

export const handleCertificateBundleIdParameter = async (
  param: any,
  params: any,
  getiOSP12Certificates: () => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Certificate Bundles...').start();
  
  let certificates: any[] = [];
  try {
    const p12Certs = await getiOSP12Certificates();
    certificates = [...(p12Certs || [])];
  } catch (error) {
    spinner.text = 'Fetching certificate bundles failed';
    spinner.fail();
    return { isError: true };
  }
  
  if (!certificates || certificates.length === 0) {
    spinner.text = 'No certificate bundle available';
    spinner.fail();
    return { isError: true };
  }
  
  // Format: 'Certificate Name (Team ID) (UUID)'
  param.params = certificates.map((certificate: any) => {
    let certName = certificate?.name || 'Unknown';
    let teamId = certificate?.teamId ? `: ${certificate.teamId}` : '';
    let appleTeam = certificate?.appleTeamId ? ` (${certificate.appleTeamId})` : '';
    let display = `${certName}${teamId}${appleTeam} (${certificate?.id})`;
    return { name: display, message: display };
  });
  
  spinner.stop();
  
  // Prompt for selection and always extract UUID
  const messageText = param.description || 'Certificate Bundle';
  const selectPrompt = createPrompt(param.name, `${messageText} (${certificates.length} options)`, param.params.map((p: any) => p.name), 10);
  const selected = await selectPrompt.run();
  
  // Extract the UUID from the last parentheses
  const match = /\(([^()]+)\)\s*$/.exec(selected);
  if (match && match[1]) {
    return { value: match[1].trim() };
  } else {
    // fallback: try to find by name
    const found = certificates.find((c: any) => selected.includes(c?.id));
    return { value: found?.id || selected };
  }
};

export const handleCertificateIdParameter = async (
  param: any,
  params: any,
  getiOSP12Certificates: () => Promise<any[]>,
  getiOSCSRCertificates: () => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Certificates...').start();
  
  let certificates: any[] = [];
  try {
    const p12Certs = await getiOSP12Certificates();
    const csrCerts = await getiOSCSRCertificates();
    certificates = [...(p12Certs || []), ...(csrCerts || [])];
  } catch (error) {
    spinner.text = 'Fetching certificates failed';
    spinner.fail();
    return { isError: true };
  }
  
  if (!certificates || certificates.length === 0) {
    spinner.text = 'No certificate available';
    spinner.fail();
    return { isError: true };
  }
  
  // Format: 'Certificate Name (Team ID) (UUID)' for P12, 'csr: Name - email (UUID)' for CSR
  param.params = certificates.map((certificate: any) => {
    if (certificate?.extension === 'P12') {
      let certName = certificate?.name || 'Unknown';
      let teamId = certificate?.teamId ? `: ${certificate.teamId}` : '';
      let appleTeam = certificate?.appleTeamId ? ` (${certificate.appleTeamId})` : '';
      let display = `${certName}${teamId}${appleTeam} (${certificate?.id})`;
      return { name: display, message: display };
    } else if (certificate?.extension === 'CSR') {
      let display = `csr: ${certificate?.name || 'Unknown'} - ${certificate?.email || ''} (${certificate?.id})`;
      return { name: display, message: display };
    } else {
      let display = `${certificate?.name || 'Unknown'} (${certificate?.id})`;
      return { name: display, message: display };
    }
  });
  
  spinner.stop();
  
  // Prompt for selection and always extract UUID
  const messageText = param.description || 'Certificate';
  const selectPrompt = createPrompt(param.name, `${messageText} (${certificates.length} options)`, param.params.map((p: any) => p.name), 10);
  const selected = await selectPrompt.run();
  
  // Extract the UUID from the last parentheses
  const match = /\(([^()]+)\)\s*$/.exec(selected);
  if (match && match[1]) {
    return { value: match[1].trim() };
  } else {
    // fallback: try to find by name
    const found = certificates.find((c: any) => selected.includes(c?.id));
    return { value: found?.id || selected };
  }
};

export const handleKeystoreIdParameter = async (
  param: any,
  params: any,
  getAndroidKeystores: () => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Keystores...').start();
  
  let keystores: any[] = [];
  try {
    keystores = await getAndroidKeystores();
  } catch (error) {
    spinner.text = 'Fetching keystores failed';
    spinner.fail();
    return { isError: true };
  }
  
  if (!keystores || keystores.length === 0) {
    spinner.text = 'No keystore available';
    spinner.fail();
    return { isError: true };
  }
  
  // Format: 'Name (ID)'
  param.params = keystores.map((keystore: any) => {
    const display = `${keystore?.name} (${keystore?.id})`;
    return { name: display, message: display };
  });
  
  spinner.stop();
  
  // Prompt for selection and always extract UUID
  const messageText = param.description || 'Keystore';
  const selectPrompt = createPrompt(param.name, `${messageText} (${keystores.length} options)`, param.params.map((p: any) => p.name), 10);
  const selected = await selectPrompt.run();
  
  // Extract the UUID from the last parentheses
  const match = /\(([^()]+)\)\s*$/.exec(selected);
  if (match && match[1]) {
    return { value: match[1].trim() };
  } else {
    // fallback: try to find by name
    const found = keystores.find((k: any) => selected.includes(k?.id));
    return { value: found?.id || selected };
  }
};

export const handleProvisioningProfileIdParameter = async (
  param: any,
  params: any,
  getProvisioningProfiles: () => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Provisioning Profiles...').start();
  
  let profiles: any[] = [];
  try {
    profiles = await getProvisioningProfiles();
  } catch (error) {
    spinner.text = 'Fetching provisioning profiles failed';
    spinner.fail();
    return { isError: true };
  }
  
  if (!profiles || profiles.length === 0) {
    spinner.text = 'No provisioning profile available';
    spinner.fail();
    return { isError: true };
  }
  
  // Format: 'Name (ID)'
  param.params = profiles.map((profile: any) => {
    const display = `${profile?.name} (${profile?.id})`;
    return { name: display, message: display };
  });
  
  spinner.stop();
  
  // Prompt for selection and always extract UUID
  const messageText = param.description || 'Provisioning Profile';
  const selectPrompt = createPrompt(param.name, `${messageText} (${profiles.length} options)`, param.params.map((p: any) => p.name), 10);
  const selected = await selectPrompt.run();
  
  // Extract the UUID from the last parentheses
  const match = /\(([^()]+)\)\s*$/.exec(selected);
  if (match && match[1]) {
    return { value: match[1].trim() };
  } else {
    // fallback: try to find by name
    const found = profiles.find((p: any) => selected.includes(p?.id));
    return { value: found?.id || selected };
  }
};

export const handleCountryCodeParameter = async (
  param: any,
  getCountries: () => Promise<any[]>
): Promise<{ isError?: boolean }> => {
  try {
    const countries = await getCountries();
    param.params = (countries || []).map((country: any) => ({ 
      name: country?.alpha2, 
      message: `${country?.name}` 
    }));
    return {};
  } catch (error) {
    return { isError: true };
  }
};

export const handleTestingGroupIdParameter = async (
  param: any,
  params: any,
  getTestingGroups: () => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Testing Groups...').start();
  
  let groups: any[] = [];
  try {
    groups = await getTestingGroups();
  } catch (error) {
    spinner.text = 'Fetching testing groups failed';
    spinner.fail();
    return { isError: true };
  }
  
  if (!groups || groups.length === 0) {
    spinner.text = 'No testing group available';
    spinner.fail();
    return { isError: true };
  }
  
  // Format: Name (UUID)
  param.params = groups.map((group: any) => {
    const display = `${group?.name} (${group?.id})`;
    return { name: display, message: display };
  });
  
  spinner.stop();
  
  // Prompt for selection and always extract UUID
  const messageText = param.description || 'Testing Group';
  const selectPrompt = createPrompt(param.name, `${messageText} (${groups.length} options)`, param.params.map((p: any) => p.name), 10);
  const selected = await selectPrompt.run();
  
  const match = /\(([^()]+)\)\s*$/.exec(selected);
  if (match && match[1]) {
    return { value: match[1].trim() };
  } else {
    return { value: selected };
  }
};

export const checkUserAuthenticationStatus = (): boolean => {
  const currentToken = readEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
  return !!currentToken;
};

export const buildCustomMenuChoices = (commands: any[]): string[] => {
  const customChoices = [];
  let choiceIndex = 1;
  
  for (const command of commands) {
    if (command.command === 'login') {
      customChoices.push(`${choiceIndex}. Authentication (Login/Logout)`);
      choiceIndex++;
    } else if (command.command === 'logout') {
      continue; // Skip logout as it's now under Authentication
    } else {
      customChoices.push(`${choiceIndex}. ${command.description}`);
      choiceIndex++;
    }
  }
  
  return customChoices;
};

export const handleAuthenticationSubMenu = async (
  autoCompleteSelector = (config: any) => new AutoComplete(config),
  readToken = () => readEnviromentConfigVariable(EnvironmentVariables.AC_ACCESS_TOKEN),
  findCommand = (cmd: string) => Commands.find(c => c.command === cmd)
): Promise<{ shouldShowMainMenuAgain?: boolean; selectedCommand?: any }> => {
  const authChoices = ['1. Login', '2. Logout', '⬅ Back'];
  
  const authSelect = autoCompleteSelector({
    name: 'authCommand',
    message: 'What do you want to do?',
    limit: 10,
    choices: authChoices,
  });
  
  const authSelected = await authSelect.run();
  
  if (authSelected === '⬅ Back') {
    return { shouldShowMainMenuAgain: true };
  }
  
  if (authSelected === '1. Login') {
    const currentToken = readToken();
    if (currentToken) {
      // Validate if the current token is still valid
      try {
        const { validateCurrentTokenIsValid } = await import('./command-runner');
        const isTokenValid = await validateCurrentTokenIsValid();

        if (isTokenValid) {
          // Token is still valid, show already logged in message
          console.error('You are already logged in. Use "Logout" to logout first.');
          return { shouldShowMainMenuAgain: true };
        } else {
          // Token is expired/invalid, clear it and proceed with new login
          console.log('Current token is expired or invalid. Clearing stored token and proceeding with new login...');
          const { clearStoredToken } = await import('./command-runner');
          clearStoredToken();
        }
      } catch (error) {
        // If token validation fails due to network issues, assume token is valid
        console.error('You are already logged in. Use "Logout" to logout first.');
        return { shouldShowMainMenuAgain: true };
      }
    }
    return { selectedCommand: findCommand('login') };
  } else if (authSelected === '2. Logout') {
    return { selectedCommand: findCommand('logout') };
  }
  
  return { shouldShowMainMenuAgain: true };
};

export const adjustCommandIndexForAuthGrouping = (selectedCommandIndex: number, commands: any[]): number => {
  let adjustedIndex = selectedCommandIndex;
  let commandCount = 0;
  
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (cmd.command === 'logout') {
      continue; // Skip logout as it's grouped under Authentication
    }
    if (commandCount === selectedCommandIndex) {
      adjustedIndex = i;
      break;
    }
    commandCount++;
  }
  
  return adjustedIndex;
};

export const runCommandsInteractivelyInner = async () => {
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
      const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
      const version = `v${packageJson.version}`;
      console.info(
        chalk.hex(APPCIRCLE_COLOR)(
          `
      ███████ ██████╗ ██████╗  ██████╗██╗██████╗  ██████╗██╗     ███████╗
      ██╔══██╗██╔══██╗██╔══██╗██╔════╝██║██╔══██╗██╔════╝██║     ██╔════╝
      ███████║██████╔╝██████╔╝██║     ██║██████╔╝██║     ██║     █████╗  
      ██╔══██║██╔═══╝ ██╔═══╝ ██║     ██║██╔══██╗██║     ██║     ██╔══╝  
      ██║  ██║██║     ██║     ╚██████╗██║██║  ██║╚██████╗███████╗███████╗
      ╚═╝  ╚═╝╚═╝     ╚═╝      ╚═════╝╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚══════╝             
      \t\t\t\t\t\t\t${version}
      `
        )
      );
      hasShownLogo = true;
    } else {
      const label = ' Main Menu ';
      const totalWidth = 80;
      const dash = '─';

      const sideLength = Math.floor((totalWidth - label.length) / 2);
      const line = chalk.hex("#ffffff")(
        dash.repeat(sideLength) +
        chalk.hex("#ffffff")(label) +
        dash.repeat(totalWidth - sideLength - label.length)
      );

      console.log('\n' + line + '\n');
    }

    // Custom choices to group Login and Logout under Authentication
    const customChoices = buildCustomMenuChoices(Commands);
    
    const choices = [
      ...customChoices,
      '0. Exit'
    ];

    const commandSelect = new AutoComplete({
      name: 'command',
      message: `What do you want to do?`,
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
    
    // Handle Authentication group selection
    if (selected.includes('Authentication')) {
      const authResult = await handleAuthenticationSubMenu();
      if (authResult.shouldShowMainMenuAgain) {
        return { shouldShowMainMenuAgain: true };
      }
      if (authResult.selectedCommand) {
        selectedCommand = authResult.selectedCommand;
      }
    } else {
      // Handle regular command selection
      // Adjust index to account for Authentication grouping
      const adjustedIndex = adjustCommandIndexForAuthGrouping(selectedCommandIndex, Commands);
      selectedCommand = Commands[adjustedIndex];
    }
    
    navigationStack.length = 0;
    navigationStack.push({ command: selectedCommand, preparedCommand: undefined });

    const preparedProgramCommand = await handleSelectedCommand(selectedCommand, {});

    if (preparedProgramCommand) {
      if ((preparedProgramCommand as any).isBackToMainMenu) {
        navigationStack.length = 0;
        return { shouldShowMainMenuAgain: true };
      }
      

      

      
      try {
        await runCommand(preparedProgramCommand);
        if (isExplicitInteractiveMode) {
          navigationStack.length = 0;
          return { shouldShowMainMenuAgain: true };
        }
      } catch (commandError) {
        if (commandError instanceof AppcircleExitError) {
          if (commandError.code === 0) {
            if (isExplicitInteractiveMode) {
              navigationStack.length = 0;
              return { shouldShowMainMenuAgain: true };
            }
            return;
          } else {
            throw commandError;
          }
        } else {
          throw commandError;
        }
      }
    } else {
      if (isExplicitInteractiveMode) {
        navigationStack.length = 0;
        return { shouldShowMainMenuAgain: true };
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

export const handlePublishProfileIdParameter = async (
  param: any,
  params: any,
  getPublishProfiles: (options: { platform: any }) => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing Publish Profiles...').start();
  try {
    const selectedPlatform = params?.["platform"];
    const publishProfiles = await getPublishProfiles({ platform: selectedPlatform });
    if (!publishProfiles || publishProfiles.length === 0) {
      spinner.text = 'No publish profiles available';
      spinner.fail();
      return { isError: true };
    }

    const profileParams = publishProfiles.map((profile: any) => {
      const display = `${profile?.name || 'Unknown'} (${profile?.id || ''}) - ${(OperatingSystems as any)?.[profile?.platformType] || 'Unknown Platform'}`;
      return { name: display, message: display, _id: profile?.id };
    });

    if (param) {
      param.params = profileParams;
    }
    if (params) {
      params._publishProfileParams = profileParams;
    }
    spinner.stop();

    const messageText = param?.description || 'Publish Profile';
    const selectPrompt = createPrompt(
      param?.name || 'publishProfileId',
      `${messageText} (${profileParams.length} options)`,
      profileParams.map((p: any) => p.name || p.message),
      10
    );

    const selected = await selectPrompt.run();
    
    // Extract ID from parentheses like (profile-id)
    const match = /\(([^)]+)\)/.exec(selected);
    if (match && match[1]) {
      return { value: match[1].trim() };
    } else {
      return { value: selected };
    }
  } catch (error) {
    spinner.fail('Failed to load publish profiles');
    return { isError: true };
  }
};

export const handleAppVersionIdParameter = async (
  param: any,
  params: any,
  getAppVersions: (options: { platform: any; publishProfileId: any }) => Promise<any[]>,
  createPrompt = createAutoCompletePrompt,
  oraSpinner = ora
): Promise<{ value?: string; isError?: boolean }> => {
  const spinner = oraSpinner('Listing App Versions...').start();
  try {
    const selectedPlatform = params?.["platform"];
    let selectedPublishProfileId = params?.["publishProfileId"];
    
    // Extract profile ID from parentheses if needed
    const match = /\(([^)]+)\)/.exec(selectedPublishProfileId);
    if (match && match[1]) {
      selectedPublishProfileId = match[1].trim();
      if (params) {
        params.publishProfileId = selectedPublishProfileId;
      }
    }
    
    const appVersions = await getAppVersions({ 
      platform: selectedPlatform, 
      publishProfileId: selectedPublishProfileId 
    });
    
    if (!appVersions || appVersions.length === 0) {
      spinner.text = 'No app versions available';
      spinner.fail();
      return { isError: true };
    }
    
    const appVersionChoices = appVersions.map((appVersion: any) => {
      const display = ` ${appVersion?.name || 'Unknown'}(${appVersion?.version || 'Unknown'}) - ${appVersion?.id || ''} ${appVersion?.releaseCandidate ? '(Release Candidate)' : ''}`;
      return { name: display, message: display, _id: appVersion?.id };
    });
    
    if (param) {
      param.params = appVersionChoices;
    }
    spinner.stop();

    const messageText = param?.description || 'App Version';
    const selectPrompt = createPrompt(
      param?.name || 'appVersionId',
      `${messageText} (${appVersionChoices.length} options)`,
      appVersionChoices.map((p: any) => p.name || p.message),
      10
    );
    
    const selected = await selectPrompt.run();
    
    // Try to extract UUID from the start of the string (pattern: " name(version) - uuid-here ")
    const matchAppVersion = /^\s*([0-9a-fA-F-]{36})\b/.exec(selected);
    if (matchAppVersion && matchAppVersion[1]) {
      return { value: matchAppVersion[1].trim() };
    } else {
      // Fallback: try to find by exact name/message match
      const found = appVersionChoices.find((p: any) => p?.name === selected || p?.message === selected);
      if (found && found._id) {
        return { value: found._id };
      } else {
        return { value: selected };
      }
    }
  } catch (error) {
    spinner.fail('Failed to load app versions');
    return { isError: true };
  }
};
