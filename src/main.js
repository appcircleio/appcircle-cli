import { prompt, Select, BooleanPrompt } from 'enquirer';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs';
import minimist from 'minimist';
import {
    getToken,
    getDistributionProfiles,
    createDistributionProfile,
    uploadArtifact,
    getBuildProfiles,
    startBuild,
    getEnvironmentVariableGroups,
    createEnvironmentVariableGroup,
    getEnvironmentVariables,
    createEnvironmentVariable,
    getBranches
} from './services';

const appcircleColor = '#ff8F34';
const commandParameterTypes = {
    SELECT: 'select',
    BOOLEAN: 'boolean',
    STRING: 'input',
    PASSWORD: 'password'
};
const commandTypes = {
    LOGIN: 'login',
    LIST_BUILD_PROFILES: 'listBuildProfiles',
    LIST_DISTRIBUTION_PROFILES: 'listDistributionProfiles',
    BUILD: 'build',
    UPLOAD: 'upload',
    CREATE_DISTRIBUTION_PROFILE: 'createDistributionProfile',
    LIST_ENVIRONMENT_VARIABLE_GROUPS: 'listEnvironmentVariableGroups',
    CREATE_ENVIRONMENT_VARIABLE_GROUP: 'createEnvironmentVariableGroup',
    LIST_ENVIRONMENT_VARIABLES: 'listEnvironmentVariables',
    CREATE_ENVIRONMENT_VARIABLE: 'createEnvironmentVariable'

};
const commands = [
    {
        command: commandTypes.LOGIN,
        description: 'Login',
        params: [
            {
                name: 'pat',
                description: 'Personal Access Token',
                type: commandParameterTypes.STRING
            }
        ]
    },
    {
        command: commandTypes.LIST_BUILD_PROFILES,
        description: 'Get list of build profiles',
        params: []
    },
    {
        command: commandTypes.LIST_DISTRIBUTION_PROFILES,
        description: 'Get list of distribution profiles',
        params: []
    },
    {
        command: commandTypes.BUILD,
        description: 'Start a new build',
        params: [
            {
                name: 'profileId',
                description: 'Build profile ID',
                type: commandParameterTypes.STRING
            },
            {
                name: 'branch',
                description: 'Branch',
                type: commandParameterTypes.SELECT,
                params: []
            }
        ]
    },
    {
        command: commandTypes.UPLOAD,
        description: 'Upload your mobile app to selected distribution profile',
        params: [
            {
                name: 'app',
                description: 'App path',
                type: commandParameterTypes.STRING
            },
            {
                name: 'message',
                description: 'Release notes',
                type: commandParameterTypes.STRING
            },
            {
                name: 'profileId',
                description: 'Distribution profile ID',
                type: commandParameterTypes.STRING
            }
        ]
    },
    {
        command: commandTypes.CREATE_DISTRIBUTION_PROFILE,
        description: 'Create a distribution profile',
        params: [
            {
                name: 'name',
                description: 'Profile name',
                type: commandParameterTypes.STRING
            }
        ]
    },
    {
        command: commandTypes.LIST_ENVIRONMENT_VARIABLE_GROUPS,
        description: 'Get list of environment variable groups',
        params: []
    },
    {
        command: commandTypes.CREATE_ENVIRONMENT_VARIABLE_GROUP,
        description: 'Create an environment variable group',
        params: [
            {
                name: 'name',
                description: 'Variable group name',
                type: commandParameterTypes.STRING
            }
        ]
    },
    {
        command: commandTypes.LIST_ENVIRONMENT_VARIABLES,
        description: 'Get list of environment variables',
        params: [
            {
                name: 'variableGroupId',
                description: 'Variable Groups ID',
                type: commandParameterTypes.STRING
            }
        ]
    },
    {
        command: commandTypes.CREATE_ENVIRONMENT_VARIABLE,
        description: 'Create a file or text environment variable',
        params: [
            {
                name: 'type',
                description: 'Type',
                type: commandParameterTypes.SELECT,
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
                type: commandParameterTypes.BOOLEAN
            },
            {
                name: 'variableGroupId',
                description: 'Variable group ID',
                type: commandParameterTypes.STRING
            },
            {
                name: 'key',
                description: 'Key Name',
                type: commandParameterTypes.STRING
            },
            {
                name: 'value',
                description: `Key Value (You can skip this if you selected type of ${chalk.hex(appcircleColor)('file')})`,
                type: commandParameterTypes.STRING
            },
            {
                name: 'filePath',
                description: `File path (You can skip this if you selected type of ${chalk.hex(appcircleColor)('text')})`,
                type: commandParameterTypes.STRING
            }
        ]
    }
];
let access_token = process.env.AC_ACCESS_TOKEN;

(async () => {
    let params = { access_token };
    let selectedCommand = undefined;
    let selectedCommandDescription = "";
    let selectedCommandIndex = -1;

    if (process.argv.length === 2) {
        console.info(
            chalk.hex(appcircleColor)(
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
                ...commands.map((command, index) => `${index + 1}. ${command.description}`)
            ]
        });

        selectedCommandDescription = await commandSelect.run();
        selectedCommandIndex = (selectedCommandDescription.split('.')[0] - 1);
        selectedCommand = commands[selectedCommandIndex];

        for (let param of commands[selectedCommandIndex].params) {
            if (param.name === 'branch') {
                const spinner = ora('Branches fetching').start();

                const branches = await getBranches({ access_token: process.env.AC_ACCESS_TOKEN, profileId: params.profileId });
                if (!branches || branches.length === 0) {
                    spinner.text = 'No branches available';
                    spinner.fail();
                    return;
                }

                param.params = branches.map(branch => ({ name: branch.name, description: branch.name }));

                spinner.text = 'Branches fetched';
                spinner.succeed();
            } else if (param.name === 'value' && params.isSecret) {
                param.type = commandParameterTypes.PASSWORD;
            }

            if ([commandParameterTypes.STRING, commandParameterTypes.PASSWORD].includes(param.type)) {
                const stringPrompt = await prompt([
                    {
                        type: param.type,
                        name: param.name,
                        message: param.description,
                        validate(value) {
                            if (value.length === 0) {
                                return 'This field is required';
                            } else if (['app'].includes(param.name)) {
                                return fs.existsSync(value) ? true : 'File not exists';
                            }
                            return true;
                        }
                    }
                ]);
                params[param.name] = stringPrompt[Object.keys(stringPrompt)[0]];
            } else if (param.type === commandParameterTypes.BOOLEAN) {
                const booleanPrompt = new BooleanPrompt({
                    name: param.name,
                    message: param.description,
                });
                params[param.name] = await booleanPrompt.run();
            } else if (param.type === commandParameterTypes.SELECT) {
                const selectPrompt = new Select({
                    name: param.name,
                    message: param.description,
                    choices: [
                        ...param.params.map(val => val)
                    ]
                });
                params[param.name] = await selectPrompt.run();
            }
        }

        console.info('');
    } else {
        const argv = minimist(process.argv.slice(2));
        selectedCommandDescription = argv['_'][0];
        selectedCommand = commands.find(x => x.command === selectedCommandDescription);
        selectedCommandIndex = commands.indexOf(selectedCommand);

        params = {
            ...argv
        };
        delete params['_'];
    }

    switch (selectedCommand.command) {
        case commandTypes.LOGIN:
            getToken(params);
            break;
        case commandTypes.LIST_BUILD_PROFILES:
            getBuildProfiles(params);
            break;
        case commandTypes.LIST_DISTRIBUTION_PROFILES:
            getDistributionProfiles(params);
            break;
        case commandTypes.BUILD:
            startBuild(params);
            break;
        case commandTypes.UPLOAD:
            uploadArtifact(params);
            break;
        case commandTypes.CREATE_DISTRIBUTION_PROFILE:
            createDistributionProfile(params);
            break;
        case commandTypes.LIST_ENVIRONMENT_VARIABLE_GROUPS:
            getEnvironmentVariableGroups(params);
            break;
        case commandTypes.CREATE_ENVIRONMENT_VARIABLE_GROUP:
            createEnvironmentVariableGroup(params);
            break;
        case commandTypes.LIST_ENVIRONMENT_VARIABLES:
            getEnvironmentVariables(params);
            break;
        case commandTypes.CREATE_ENVIRONMENT_VARIABLE:
            createEnvironmentVariable(params);
            break;
        default:
            console.error('Command not found');
            break;
    }
})().catch(() => { })