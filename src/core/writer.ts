import chalk from 'chalk';
import { CommandTypes } from './commands';
import { getConsoleOutputType } from '../config';
import {
  writeLoginCommand,
  writeLogoutCommand,
  writeConfigCommand,
  writeTestingDistributionCommand,
  writeBuildCommand,
  writeEnterpriseAppStoreCommand,
  writeOrganizationCommand,
  writePublishCommand,
  writeSigningIdentityCommand
} from './writer-commands';

const writersMap: { [key in CommandTypes]: (data: any) => void } = {
  [CommandTypes.CONFIG]: writeConfigCommand,
  [CommandTypes.LOGIN]: writeLoginCommand,
  [CommandTypes.LOGOUT]: writeLogoutCommand,
  [CommandTypes.TESTING_DISTRIBUTION]: writeTestingDistributionCommand,
  [CommandTypes.BUILD]: writeBuildCommand,
  [CommandTypes.ENTERPRISE_APP_STORE]: writeEnterpriseAppStoreCommand,
  [CommandTypes.ORGANIZATION]: writeOrganizationCommand,
  [CommandTypes.PUBLISH]: writePublishCommand,
  [CommandTypes.SIGNING_IDENTITY]: writeSigningIdentityCommand,
};

export const commandWriter = (command: CommandTypes, data: any) => {
  if (getConsoleOutputType() === 'json') {
    console.log(JSON.stringify(data.data || data));
  } else {
    const writer = writersMap[command];
    if (writer) {
      writer(data);
    }
  }
};

export const configWriter = (config: any) => {
  if (getConsoleOutputType() === 'json') {
    console.log(JSON.stringify(config));
  } else {
    console.table(config);
  }
};