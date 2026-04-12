import type { Config } from "~/types.ts";
import { Spinner } from "~/utils/spinner.ts";
import { log } from "~/utils/logger.ts";

export const baseUrl = (config: Config): string => {
  return `http://${config.host}:${config.port}`;
};

export const checkOllamaService = async (config: Config): Promise<void> => {
  try {
    const resp = await fetch(`${baseUrl(config)}/api/version`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    await resp.body?.cancel();
    log.debug("Ollama service is running.");
    await ensureModel(config);
  } catch {
    throw new Error(
      `Ollama service is not running at ${config.host}:${config.port}.\nPlease start Ollama and try again.`,
    );
  }
};

const formatSize = (bytes: number): string => {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(1)}GB`;
  }
  return `${Math.floor(bytes / 1_048_576)}MB`;
};

export const ensureModel = async (config: Config): Promise<void> => {
  const tagsUrl = `${baseUrl(config)}/api/tags`;

  const tagsResp = await fetch(tagsUrl);
  if (!tagsResp.ok) {
    throw new Error(`Failed to list models: HTTP ${tagsResp.status}`);
  }
  const tagsData = await tagsResp.json();
  const models: Array<{ name: string }> = tagsData.models ?? [];

  if (models.some((m) => m.name === config.model)) {
    log.debug(`Model '${config.model}' is available.`);
    return;
  }

  log.warn(
    `Model '${config.model}' not found. Attempting to pull it automatically...`,
  );

  const pullResp = await fetch(`${baseUrl(config)}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: config.model, stream: true }),
  });

  if (!pullResp.ok || !pullResp.body) {
    throw new Error(`Failed to pull model: HTTP ${pullResp.status}`);
  }

  const dec = new TextDecoder();
  const spinner = new Spinner("Downloading {spinner} 0%", "download");
  spinner.start();

  for await (const chunk of pullResp.body) {
    const line = dec.decode(chunk, { stream: true }).trim();
    if (!line) continue;

    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    if (obj.error) {
      spinner.stop();
      log.error(`Failed to pull model '${config.model}': ${obj.error}`);
      const names = models.slice(0, 5).map((m) => m.name);
      log.error("Try using one of these available models instead:");
      names.forEach((n) => log.error(`   - ${n}`));
      Deno.exit(1);
    }

    if (typeof obj.completed === "number" && typeof obj.total === "number") {
      const pct =
        obj.total > 0 ? Math.floor((100 * obj.completed) / obj.total) : 0;
      if (pct < 100) {
        spinner.update(
          `Downloading {spinner} ${pct}% (${formatSize(obj.completed)}/${formatSize(
            obj.total,
          )})`,
        );
      } else {
        spinner.update("Downloading {spinner} 100%");
      }
    }
  }
  spinner.update("Verifying download {spinner}");
  await new Promise((r) => setTimeout(r, 2_000));
  spinner.stop();

  const verifyResp = await fetch(tagsUrl);
  const verifyData = await verifyResp.json();
  const verified = ((verifyData.models ?? []) as Array<{ name: string }>).some(
    (m) => m.name === config.model,
  );

  if (verified) {
    log.info(`Model '${config.model}' downloaded successfully!`);
  } else {
    log.error(
      `Something went wrong during download. Model '${config.model}' not available.`,
    );
    Deno.exit(1);
  }
};

export const callOllama = async (
  config: Config,
  payload: Record<string, unknown>,
  spinnerMsg: string,
): Promise<string> => {
  const spinner = new Spinner(`${spinnerMsg}{spinner}`, "ellipsis");
  spinner.start();
  try {
    const resp = await fetch(`${baseUrl(config)}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.timeout * 1_000),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Ollama API HTTP ${resp.status}: ${body}`);
    }

    const data = await resp.json();
    if (data.error) throw new Error(`Ollama API error: ${data.error}`);

    const content: string | undefined = data.message?.content;
    if (!content) {
      throw new Error(
        "Failed to extract message content from Ollama response.",
      );
    }
    return content;
  } finally {
    spinner.stop();
  }
};
