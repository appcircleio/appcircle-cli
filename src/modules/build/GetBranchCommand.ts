export function GetBranchCommand() {
  const branch = this.branchModel.findById();
  if(!branch){
    await this.branchService.findBranchById();
  }

  return branch;
}

type CommandFn<TResult> = () => Promise<TResult>
