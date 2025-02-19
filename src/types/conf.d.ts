import Conf from "conf";

export interface Options {}
export declare type Migrations<T extends Record<string, any>> = Record<
  string,
  (store: Conf<T>) => void
>;
