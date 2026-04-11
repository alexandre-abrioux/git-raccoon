import { Select } from "@cliffy/prompt";
import { Cell, Table } from "@cliffy/table";
import { type Config } from "~/types.ts";
import {
  getBranchName,
  getStagedDiff,
  gitAddAll,
  gitCommit,
  gitCommitWithEdit,
} from "~/services/git.ts";
import {
  callOllama,
  checkOllamaService,
  ensureModel,
} from "~/services/ollama.ts";
import { log } from "~/utils/logger.ts";
import { colors } from "@cliffy/ansi/colors";

const SYSTEM_PROMPT = `You will act as a git commit message generator.
When receiving a git branch name and diff, you will ONLY output the commit message itself, nothing else.
No explanations, no questions, no additional comments.

Commits must follow the Conventional Commits 1.0.0 specification and be further refined using the rules outlined below.

The commit message must include the following fields: <type>, <scope>, <description>.

Guidelines:
- The <description> must be short.
- The <description> must be one line.
- The <description> must be one sentence.
- The <description> must have a maximum of 72 characters, including any spaces or special characters.
- The <description> must not include the <type> in the sentence.
- The <description> must be in English and in present tense.
- The <description> must avoid capitalization.
- The <description> must not have a period at the end.
- The <scope> must be a single word.
- The <scope> must be the modified namespace.
- The <type> must be one of the following:
  - feat: MUST be used when commits that introduce new features or functionalities to the project (this correlates with MINOR in Semantic Versioning)
  - fix: MUST be used when commits address bug fixes or resolve issues in the project (this correlates with PATCH in Semantic Versioning)
  - types other than feat: and fix: can be used with lesser priority:
    - build: Used when a commit affects the build system or external dependencies. It includes changes to build scripts, build configurations, or build tools used in the project
    - chore: Typically used for routine or miscellaneous tasks related to the project, such as code reformatting, updating dependencies, or making general project maintenance
    - ci: CI stands for continuous integration. This type is used for changes to the project's continuous integration or deployment configurations, scripts, or infrastructure
    - docs: Documentation plays a vital role in software projects. The docs type is used for commits that update or add documentation, including readme files, API documentation, user guides or code comments that act as documentation
    - i18n: This type is used for commits that involve changes related to internationalization or localization. It includes changes to localization files, translations, or internationalization-related configurations.
    - perf: Short for performance, this type is used when a commit improves the performance of the code or optimizes certain functionalities
    - refactor: Commits typed as refactor involve making changes to the codebase that neither fix a bug nor add a new feature. Refactoring aims to improve code structure, organization, or efficiency without changing external behavior
    - revert: Commits typed as revert are used to undo previous commits. They are typically used to reverse changes made in previous commits
    - style: The style type is used for commits that focus on code style changes, such as formatting, indentation, or whitespace modifications. These commits do not affect the functionality of the code but improve its readability and maintainability
    - test: Used for changes that add or modify test cases, test frameworks, or other related testing infrastructure.
`;

const generateCommitMessage = async (
  config: Config,
  branchName: string,
  diff: string,
): Promise<string> => {
  const payload = {
    model: config.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Branch name: \`${branchName}\`\n\nGit diff:\n${diff}`,
      },
    ],
    stream: false,
    format: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "feat",
            "fix",
            "build",
            "chore",
            "ci",
            "docs",
            "i18n",
            "perf",
            "refactor",
            "revert",
            "style",
            "test",
          ],
        },
        scope: { type: "string" },
        description: { type: "string" },
      },
      required: ["type", "scope", "description"],
    },
    options: { temperature: 0.3 },
  };

  const content = await callOllama(
    config,
    payload,
    "🦝 Generating commit message...",
  );

  try {
    const parsed = JSON.parse(content);
    const type: string = parsed.type ?? "";
    const scope: string = parsed.scope ? `(${parsed.scope})` : "";
    const description: string = parsed.description ?? "";

    if (!type || !description) {
      log.error(
        `Error: Ollama response missing 'type' or 'description'.\nMessage content: ${content}`,
      );
      return content;
    }

    const desc = description.charAt(0).toLowerCase() + description.slice(1);
    return `${type}${scope}: ${desc}`;
  } catch {
    log.warn("Warning: Could not parse JSON response, using raw content.");
    return content;
  }
};

const confirmCommit = async (message: string): Promise<void> => {
  log.info("🦝 Generated commit message:");

  const table = new Table([new Cell(colors.bold.blue(message))]);
  table.border().render();

  const choice = await Select.prompt({
    message: "Do you want to use or edit this commit message?",
    options: [
      { name: "Yes - commit with this message", value: "y" },
      { name: "Edit - open editor to modify message", value: "e" },
      { name: "No - discard and exit", value: "n" },
    ],
    default: "y",
  });

  switch (choice) {
    case "y":
      await gitCommit(message);
      log.debug("Changes committed with the generated message.");
      break;
    case "n":
      log.debug("Generated commit message only (not committed).");
      break;
    case "e":
      await gitCommitWithEdit(message);
      log.debug("Changes committed with the edited message.");
      break;
  }
};

export const cmdCommit = async (
  config: Config,
  addAll: boolean,
): Promise<void> => {
  if (addAll) await gitAddAll();

  const branchName = await getBranchName();
  const diff = await getStagedDiff();

  if (!diff.trim()) {
    log.error("Error: No changes to commit");
    Deno.exit(1);
  }

  await checkOllamaService(config);
  log.debug("Ollama service is running.");
  await ensureModel(config);
  log.debug(`Model '${config.model}' is available.`);

  log.debug("Generating commit message with Ollama...");
  const message = await generateCommitMessage(config, branchName, diff);

  if (!message.trim()) {
    log.error("Error: Failed to generate commit message");
    Deno.exit(1);
  }

  await confirmCommit(message);
};
