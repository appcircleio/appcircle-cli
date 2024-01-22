import ora from "ora";
import { getConsoleOutputType } from "../config";

export const createOra = (message: string) => {
  if (getConsoleOutputType() === "json") {
    return {
      fail: () => {},
      succeed: () => {},
      text: "",
      start: () => ({
        fail: () => {},
        succeed: () => {},
        text: "",
      }),
    };
  } else {
    return ora(message);
  }
};
