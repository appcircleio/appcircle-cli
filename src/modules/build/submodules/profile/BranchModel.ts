import { config } from "process"

class BranchModel {
  constructor(private cacheProvider:iCacheProvider){
    this.cacheProvider.get(`profile-${this.profileId}-branches`);
  }

  findBranchById(id:string) {

  }
}