//@ts-ignore https://github.com/enquirer/enquirer/issues/212
import { prompt, Select, BooleanPrompt } from 'enquirer';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs';
import minimist from 'minimist';
import {
    getToken,
    getDistributionProfiles,
    createDistributionProfile,
    downloadArtifact,
    uploadArtifact,
    getBuildProfiles,
    startBuild,
    getEnvironmentVariableGroups,
    createEnvironmentVariableGroup,
    getEnvironmentVariables,
    createEnvironmentVariable,
    getBranches,
    getCommits
} from './services';

import { readVariable, EnvironmentVariables } from './data';

const APPCIRCLE_COLOR = '#ff8F34';
const CommandParameterTypes = {
    SELECT: 'select',
    BOOLEAN: 'boolean',
    STRING: 'input',
    PASSWORD: 'password'
};

const CommandTypes = {
    LOGIN: 'login',
    LIST_BUILD_PROFILES: 'listBuildProfiles',
    LIST_BUILD_PROFILE_BRANCHES: 'listBuildProfileBranches',
    LIST_BUILD_PROFILE_COMMITS: 'listBuildProfileCommits',
    LIST_DISTRIBUTION_PROFILES: 'listDistributionProfiles',
    BUILD: 'build',
    DOWNLOAD: 'download',
    UPLOAD: 'upload',
    CREATE_DISTRIBUTION_PROFILE: 'createDistributionProfile',
    LIST_ENVIRONMENT_VARIABLE_GROUPS: 'listEnvironmentVariableGroups',
    CREATE_ENVIRONMENT_VARIABLE_GROUP: 'createEnvironmentVariableGroup',
    LIST_ENVIRONMENT_VARIABLES: 'listEnvironmentVariables',
    CREATE_ENVIRONMENT_VARIABLE: 'createEnvironmentVariable'
};

const Commands = [
    {
        command: CommandTypes.LOGIN,
        description: 'Login',
        params: [
            {
                name: 'pat',
                description: 'Personal Access Token',
                type: CommandParameterTypes.STRING
            }
        ]
    },
    {
        command: CommandTypes.LIST_BUILD_PROFILES,
        description: 'Get list of build profiles',
        params: []
    },
    {
        command: CommandTypes.LIST_BUILD_PROFILE_BRANCHES,
        description: 'Get list of branches of a build profile',
        params: [
            {
                name: 'profileId',
                description: 'Build profile ID',
                type: CommandParameterTypes.STRING
            }
        ]
    },
    {
        command: CommandTypes.LIST_BUILD_PROFILE_COMMITS,
        description: 'Get list of commits of a branch',
        params: [
            {
                name: 'branchId',
                description: 'Branch ID',
                type: CommandParameterTypes.STRING
            }
        ]
    },
    {
        command: CommandTypes.LIST_DISTRIBUTION_PROFILES,
        description: 'Get list of distribution profiles',
        params: []
    },
    {
        command: CommandTypes.BUILD,
        description: 'Start a new build',
        params: [
            {
                name: 'profileId',
                description: 'Build profile ID',
                type: CommandParameterTypes.STRING
            },
            {
                name: 'branch',
                description: 'Branch',
                type: CommandParameterTypes.SELECT,
                params: []
            }
        ]
    },
    {
        command: CommandTypes.DOWNLOAD,
        description: 'Download your artifact to the given directory on your machine',
        params: [
            {
                name: 'path',
                description: '[OPTIONAL] The path for artifacts to be downloaded: (Defaults to the current directory)',
                type: CommandParameterTypes.STRING,
                required: false
            },
            {
                name: 'buildId',
                description: 'Build ID of your branch. This can be retrieved from profile list',
                type: CommandParameterTypes.STRING
            },
            {
                name: 'commitId',
                description: 'Commit ID of your build',
                type: CommandParameterTypes.STRING
            }
        ]
    },
    {
        command: CommandTypes.UPLOAD,
        description: 'Upload your mobile app to selected distribution profile',
        params: [
            {
                name: 'app',
                description: 'App path',
                type: CommandParameterTypes.STRING
            },
            {
                name: 'message',
                description: 'Release notes',
                type: CommandParameterTypes.STRING
            },
            {
                name: 'profileId',
                description: 'Distribution profile ID',
                type: CommandParameterTypes.STRING
            }
        ]
    },
    {
        command: CommandTypes.CREATE_DISTRIBUTION_PROFILE,
        description: 'Create a distribution profile',
        params: [
            {
                name: 'name',
                description: 'Profile name',
                type: CommandParameterTypes.STRING
            }
        ]
    },
    {
        command: CommandTypes.LIST_ENVIRONMENT_VARIABLE_GROUPS,
        description: 'Get list of environment variable groups',
        params: []
    },
    {
        command: CommandTypes.CREATE_ENVIRONMENT_VARIABLE_GROUP,
        description: 'Create an environment variable group',
        params: [
            {
                name: 'name',
                description: 'Variable group name',
                type: CommandParameterTypes.STRING
            }
        ]
    },
    {
        command: CommandTypes.LIST_ENVIRONMENT_VARIABLES,
        description: 'Get list of environment variables',
        params: [
            {
                name: 'variableGroupId',
                description: 'Variable Groups ID',
                type: CommandParameterTypes.STRING
            }
        ]
    },
    {
        command: CommandTypes.CREATE_ENVIRONMENT_VARIABLE,
        description: 'Create a file or text environment variable',
        params: [
            {
                name: 'type',
                description: 'Type',
                type: CommandParameterTypes.SELECT,
                params: [
                    {
                        name: 'file',
                        description: 'File'
                    },
                    {
                        name: 'text',
                        description: 'Text'
                    }
                ]
            },
            {
                name: 'isSecret',
                description: 'Secret',
                type: CommandParameterTypes.BOOLEAN
            },
            {
                name: 'variableGroupId',
                description: 'Variable group ID',
                type: CommandParameterTypes.STRING
            },
            {
                name: 'key',
                description: 'Key Name',
                type: CommandParameterTypes.STRING
            },
            {
                name: 'value',
                description: `Key Value (You can skip this if you selected type of ${chalk.hex(APPCIRCLE_COLOR)('file')})`,
                type: CommandParameterTypes.STRING
            },
            {
                name: 'filePath',
                description: `File path (You can skip this if you selected type of ${chalk.hex(APPCIRCLE_COLOR)('text')})`,
                type: CommandParameterTypes.STRING
            }
        ]
    }
];


(async () => {
    const accessToken = readVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
    let params: any = {};
    let selectedCommand: typeof Commands[number];
    let selectedCommandDescription = '';
    let selectedCommandIndex = -1;

    if (process.argv.length === 2) {
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

        const commandSelect = new Select({
            name: 'command',
            message: 'What do you want to do?',
            choices: [
                ...Commands.map((command, index) => `${index + 1}. ${command.description}`)
            ]
        });

        selectedCommandDescription = await commandSelect.run();
        selectedCommandIndex = (Number(selectedCommandDescription.split('.')[0]) - 1);
        selectedCommand = Commands[selectedCommandIndex];

        for (let param of selectedCommand.params) {
            if (param.name === 'branch') {
                const spinner = ora('Branches fetching').start();

                const branches = await getBranches({ profileId: params.profileId || '' });
                if (!branches || branches.length === 0) {
                    spinner.text = 'No branches available';
                    spinner.fail();
                    return;
                }
                //@ts-ignore
                param.params = branches.map((branch: any) => ({ name: branch.name, description: branch.name }));

                spinner.text = 'Branches fetched';
                spinner.succeed();
            } else if (param.name === 'value' && params.isSecret) {
                param.type = CommandParameterTypes.PASSWORD;
            }

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
                        }
                    }
                ]);
                (params as any)[param.name] = (stringPrompt as any)[Object.keys(stringPrompt)[0]];
            } else if (param.type === CommandParameterTypes.BOOLEAN) {
                const booleanPrompt = new BooleanPrompt({
                    name: param.name,
                    message: param.description,
                });
                //@ts-ignore
                params[param.name] = await booleanPrompt.run();
            } else if (param.type === CommandParameterTypes.SELECT) {
                const selectPrompt = new Select({
                    name: param.name,
                    message: param.description,
                    choices: [
                        //@ts-ignore
                        ...param.params.map((val: any) => val)
                    ]
                });
                (params as any)[param.name] = await selectPrompt.run();
            }
        }

        console.info('');
    } else {
        const argv = minimist(process.argv.slice(2));
        selectedCommandDescription = argv['_'][0];
        selectedCommand = Commands.find(x => x.command === selectedCommandDescription) || { command: '', description: '', params: [] };
        selectedCommandIndex = Commands.indexOf(selectedCommand);

        params = {
            ...params,
            ...argv
        };
        delete (params as any)['_'];
    }

    switch (selectedCommand.command) {
        case CommandTypes.LOGIN:
            getToken(params);
            break;
        case CommandTypes.LIST_BUILD_PROFILES:
            getBuildProfiles(params);
            break;
        case CommandTypes.LIST_BUILD_PROFILE_BRANCHES:
            getBranches(params);
            break;
        case CommandTypes.LIST_BUILD_PROFILE_COMMITS:
            getCommits(params);
            break;
        case CommandTypes.LIST_DISTRIBUTION_PROFILES:
            getDistributionProfiles(params);
            break;
        case CommandTypes.BUILD:
            startBuild(params);
            break;
        case CommandTypes.DOWNLOAD:
            downloadArtifact(params);
            break;
        case CommandTypes.UPLOAD:
            uploadArtifact(params);
            break;
        case CommandTypes.CREATE_DISTRIBUTION_PROFILE:
            createDistributionProfile(params);
            break;
        case CommandTypes.LIST_ENVIRONMENT_VARIABLE_GROUPS:
            getEnvironmentVariableGroups(params);
            break;
        case CommandTypes.CREATE_ENVIRONMENT_VARIABLE_GROUP:
            createEnvironmentVariableGroup(params);
            break;
        case CommandTypes.LIST_ENVIRONMENT_VARIABLES:
            getEnvironmentVariables(params);
            break;
        case CommandTypes.CREATE_ENVIRONMENT_VARIABLE:
            createEnvironmentVariable((params as any));
            break;
        default:
            console.error('Command not found');
            break;
    }
})().catch(() => { })