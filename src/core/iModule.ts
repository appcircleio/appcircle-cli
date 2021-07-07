import { Command } from "./Command";

export interface iModule {
  commands: Command[],
  runCommand: <TResult= null>(command: Command) => Promise<TResult>
}
