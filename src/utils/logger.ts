import { colors } from "@cliffy/ansi/colors";

export const log = {
  debug: (msg: string) => console.log(colors.gray(msg)),
  info: (msg: string) => console.log(colors.bold.green(msg)),
  warn: (msg: string) => console.log(colors.bold.yellow(msg)),
  error: (msg: string) => console.error(colors.bold.red(msg)),
};
