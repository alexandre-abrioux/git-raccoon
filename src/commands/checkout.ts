import { type Config } from "~/types.ts";
import { getUnstagedDiff, gitCheckoutNewBranch } from "~/services/git.ts";
import { getRandomName } from "~/utils/names.ts";
import {
  callOllama,
  checkOllamaService,
  ensureModel,
} from "~/services/ollama.ts";
import { log } from "~/utils/logger.ts";

const SYSTEM_PROMPT = `You will act as a git branch name generator.
When receiving a git diff, you will ONLY output the branch name message itself, nothing else.
No explanations, no questions, no additional comments.
Guidelines:
- The branch name must be short.
- The branch name must be 30 characters maximum.
- The branch name must be lowercase.
- The branch name must NOT contain special characters, except dashes.
- The branch name must NOT contain spaces, replace them by dashes.
`;

const generateBranchName = async (
  config: Config,
  diff: string,
): Promise<string> => {
  const payload = {
    model: config.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Git diff:\n${diff}` },
    ],
    stream: false,
    options: { temperature: 0.3 },
  };
  const branchName = await callOllama(
    config,
    payload,
    "Generating branch name",
  );
  return branchName.trim();
};

export const cmdCheckout = async (config: Config): Promise<void> => {
  const diff = await getUnstagedDiff();

  let branchName: string;
  if (!diff.trim()) {
    branchName = getRandomName();
  } else {
    await checkOllamaService(config);
    branchName = await generateBranchName(config, diff);
  }

  if (!branchName) {
    log.error("Error: Failed to generate branch name");
    Deno.exit(1);
  }

  Deno.stdout.write(new TextEncoder().encode("🦝 "));
  await gitCheckoutNewBranch(branchName);
};
