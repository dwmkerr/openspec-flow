// Stub create-spec handler. Proves the agent runtime is wired
// end-to-end: prompt loaded from adjacent markdown, interpolation,
// streaming through formatChunkPreview, final reply returned.
//
// Real implementation (clone repo, write OpenSpec artefacts, branch,
// commit, push, open PR with metadata block) lands in the next
// change (`wire-create-spec-handler`).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAgent, type RunAgentLogger } from "../../agent/run.js";

// Read the prompt once at module load. Cached for the process
// lifetime — prompts don't change at runtime. CJS module, so
// __dirname is provided by the runtime.
const PROMPT_TEMPLATE = readFileSync(join(__dirname, "prompt.md"), "utf8");

export interface HandleCreateSpecOpts {
  issueNumber: number;
  issueTitle: string;
  log: RunAgentLogger;
  // Hook for tests to substitute the agent runner.
  runner?: typeof runAgent;
}

const interpolate = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);

export const handleCreateSpec = async (
  opts: HandleCreateSpecOpts,
): Promise<string> => {
  const prompt = interpolate(PROMPT_TEMPLATE, {
    issueNumber: String(opts.issueNumber),
    issueTitle: opts.issueTitle,
  });

  opts.log.info(`create-spec stub: starting for issue #${opts.issueNumber}`);

  const run = opts.runner ?? runAgent;
  const reply = await run({ prompt, log: opts.log });

  opts.log.info(`create-spec stub: done (${reply.length} chars)`);
  return reply;
};
