import { log } from "~/utils/logger.ts";
import { command } from "~/commands/index.ts";

export const main = async (): Promise<void> => {
  try {
    await command.parse();
  } catch (e) {
    log.error(e instanceof Error ? e.message : String(e));
    Deno.exit(1);
  }
};
