import ora from "ora";

export const createOra = (message: string, options: { output?: "plain" | "json" } = {}) => {
  if (options.output === "json") {
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
