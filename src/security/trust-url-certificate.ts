import { exec, spawn } from 'child_process';
import { platform } from 'os';
import { EnvironmentVariables, readEnviromentConfigVariable } from '../config';
export async function trustAppcircleCertificate() {

    const osType = platform();
  
    // Check if the operating system is either Linux or macOS
    if (osType !== 'darwin' && osType !== 'linux') {
      console.error(
        `Error: This command is supported on macOS and Linux only.`
      );
      process.exit(1); // Exit with a non-zero code indicating an error
    }
  
    const path = require('path');
    const bashScriptPath = path.join(
      __dirname,
      '../../scripts/install_cert.sh'
    );
    console.log(bashScriptPath)
    // const bashScriptPath = 'src/scripts/install_cert.sh';
  
    const appcircleUrl = readEnviromentConfigVariable(EnvironmentVariables.API_HOSTNAME);;
  
    // Use 'bash' as the command to spawn a new shell process
    const childProcess = spawn('bash', [bashScriptPath, appcircleUrl]);
  
    // Handle output stream
    childProcess.stdout.on('data', data => {
      console.log(`${data}`);
    });
  
    // Handle error stream
    childProcess.stderr.on('data', data => {
      console.error(`${data}`);
    });
  
    // Handle when the process needs input (e.g., sudo password)
    childProcess.stdin.write('\n');
    childProcess.stdin.end();
  
    // Handle when the process exits
    childProcess.on('exit', (code, signal) => {
      if (signal !== null) {
        console.log(`Bash script process killed with signal ${signal}`);
      }
    });
  }