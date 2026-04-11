import { Command } from "@cliffy/command";
import { assertGitRepo } from "~/services/git.ts";
import { cmdCheckout } from "~/commands/checkout.ts";
import { cmdCommit } from "~/commands/commit.ts";
import type { Config } from "~/types.ts";
import denoConfig from "../../deno.json" with { type: "json" };

export const command = new Command()
  .name("git-raccoon")
  .version(denoConfig.version)
  .description("AI-powered git helper using Ollama")
  .globalOption("--host <host:string>", "Ollama host", {
    default: Deno.env.get("OLLAMA_HOST") ?? "localhost",
  })
  .globalOption("--port <port:string>", "Ollama port", {
    default: Deno.env.get("OLLAMA_PORT") ?? "11434",
  })
  .globalOption("--model <model:string>", "Ollama model", {
    default: Deno.env.get("OLLAMA_MODEL") ?? "qwen2.5-coder:7b",
  })
  .globalOption("--timeout <timeout:string>", "Request timeout in seconds", {
    default: Deno.env.get("OLLAMA_TIMEOUT") ?? "180",
  })
  .action(() => {
    command.showHelp();
  })
  .command("checkout", "Create a new branch with an AI-generated name")
  .action(async (options) => {
    await assertGitRepo();
    const config: Config = {
      host: options.host,
      port: options.port,
      model: options.model,
      timeout: parseInt(options.timeout),
    };
    await cmdCheckout(config);
  })
  .command("commit", "Generate an AI commit message and commit staged changes")
  .option("-a, --all", "Stage all changes (git add .) before committing")
  .action(async (options) => {
    await assertGitRepo();
    const config: Config = {
      host: options.host,
      port: options.port,
      model: options.model,
      timeout: parseInt(options.timeout),
    };
    await cmdCommit(config, options.all ?? false);
  });
