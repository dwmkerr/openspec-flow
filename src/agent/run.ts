// Thin wrapper around Claude Agent SDK's `query()`. Every handler in
// the repo invokes Claude through this one function so streaming,
// formatting, error handling, and env-var reads stay in one place.

// The SDK is ESM-only; this module is CJS. Use a dynamic `import()`
// inside the function so the require-time module load succeeds. Types
// come in via a separately-attributed type-only import.
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk" with { "resolution-mode": "import" };
import { formatChunkPreview } from "./format-chunk.js";

// Minimal logger surface — pino's `info(msg: string)` satisfies this,
// as does `console`. Keeps the agent runtime decoupled from Probot.
export interface RunAgentLogger {
  info: (msg: string) => void;
  warn: (msg: string, err?: unknown) => void;
}

export interface RunAgentOpts {
  prompt: string;
  systemPrompt?: string;
  cwd?: string;
  log: RunAgentLogger;
  // Pass-through for anything the SDK supports that we don't want to
  // bake into our shape. Use sparingly.
  options?: Partial<Options>;
}

// The SDK authenticates with `ANTHROPIC_API_KEY` (x-api-key header) or
// `ANTHROPIC_AUTH_TOKEN` (Authorization bearer, used by gateways). Either
// is sufficient; the run only fails when both are absent.
export const assertAnthropicCredentials = (
  env: NodeJS.ProcessEnv = process.env,
): void => {
  if (!env.ANTHROPIC_API_KEY && !env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error(
      "No Anthropic credential set. Set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN in .env or your environment.",
    );
  }
};

// Returns the final assistant text from the `SDKResultMessage`.
// Throws on missing credentials, on `result.is_error`, and on any error
// the SDK surfaces. Streaming side-effect: every yielded chunk is
// printed via `opts.log.info(formatChunkPreview(chunk))`.
export const runAgent = async (opts: RunAgentOpts): Promise<string> => {
  assertAnthropicCredentials();

  const sdkOptions: Options = {
    ...(opts.systemPrompt ? { systemPrompt: opts.systemPrompt } : {}),
    ...(opts.cwd ? { cwd: opts.cwd } : {}),
    ...(opts.options ?? {}),
  };

  let finalText = "";
  let errored = false;
  const errors: string[] = [];

  try {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    for await (const message of query({
      prompt: opts.prompt,
      options: sdkOptions,
    })) {
      opts.log.info(formatChunkPreview(message as SDKMessage));
      if (message.type === "result") {
        if (message.subtype === "success") {
          finalText = message.result ?? "";
        } else {
          errored = true;
          errors.push(...(message.errors ?? [message.subtype]));
        }
      }
    }
  } catch (err) {
    opts.log.warn(`agent run failed: ${(err as Error).message}`);
    throw err;
  }

  if (errored) {
    throw new Error(`agent run errored: ${errors.join("; ")}`);
  }

  return finalText;
};
