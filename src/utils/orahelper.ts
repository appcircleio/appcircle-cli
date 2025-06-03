import ora from "ora";
import { getConsoleOutputType } from "../config";

export const createOra = (message: string) => {
  if (getConsoleOutputType() === "json") {
    return {
      fail: () => {},
      succeed: () => {},
      stop: () => {},
      text: "",
      start: () => ({
        fail: () => {},
        succeed: () => {},
        stop: () => {},
        text: "",
      }),
    };
  } else {
    return ora(message);
  }
};
