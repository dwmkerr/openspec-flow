// Per-chunk pretty-printer for Claude Agent SDK streamed messages.
//
// Adapted from dwmkerr/claude-code-agent
//   src/lib/format-chunk.ts @ c23d1bc2af4af6f5b37fc7181c443e9f3157d506
// That formatter consumed Claude CLI stream-json output. The Agent
// SDK exposes a typed `SDKMessage` union with a slightly different
// shape: `result` is its own top-level type instead of a `system`
// subtype, and assistant content lives at `message.content` on every
// turn rather than nested under `message.message.content`. The
// colour/truncation logic and per-block branches carry over.

import chalk from "chalk";
// SDK is ESM-only; CJS host needs the resolution-mode attribute on a
// type-only import to read its types without forcing an actual import.
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk" with { "resolution-mode": "import" };

export const getTermWidth = (): number => process.stdout.columns || 80;

// Truncate so the formatted line fits the terminal after prefix + indent.
// Floors at 20 chars so very narrow terms still print something readable.
export const truncateToFit = (
  text: string,
  prefixLen: number,
  indent: number,
  termWidth: number,
): string => {
  const available = Math.max(termWidth - indent - prefixLen - 3, 20);
  if (text.length <= available) return text;
  return text.substring(0, available) + "...";
};

// Pull the typed assistant/user message content array, or [] if absent.
const contentBlocks = (msg: SDKMessage): Array<Record<string, unknown>> => {
  const m = msg as { message?: { content?: unknown } };
  const c = m.message?.content;
  return Array.isArray(c) ? (c as Array<Record<string, unknown>>) : [];
};

export const formatChunkPreview = (
  msg: SDKMessage,
  indent = 0,
  termWidth = getTermWidth(),
): string => {
  if (msg.type === "system") {
    if (msg.subtype === "init") {
      const sid = msg.session_id.substring(0, 8);
      return `${chalk.blue("system")}:${chalk.yellow("init")} ${chalk.dim(`session=${sid}...`)}`;
    }
    // compact_boundary or anything else
    return `${chalk.blue("system")}:${chalk.yellow(msg.subtype)}`;
  }

  if (msg.type === "result") {
    if (msg.subtype === "success") {
      const prefix = "result:success ";
      const text = truncateToFit(
        (msg.result || "").replace(/\s+/g, " "),
        prefix.length + 2,
        indent,
        termWidth,
      );
      return `${chalk.blue("result")}:${chalk.green("success")} ${chalk.dim(`"${text}"`)}`;
    }
    return `${chalk.blue("result")}:${chalk.red(msg.subtype)} ${chalk.dim((msg.errors ?? []).join("; "))}`;
  }

  const typeColor = msg.type === "assistant" ? chalk.green : chalk.cyan;

  const blocks = contentBlocks(msg);
  const first = blocks[0];
  if (!first) return `${typeColor(msg.type)}: ${chalk.dim("(empty)")}`;

  if (first.type === "text" && typeof first.text === "string") {
    const prefix = `${msg.type}: `;
    const text = truncateToFit(
      first.text.replace(/\s+/g, " "),
      prefix.length + 2,
      indent,
      termWidth,
    );
    const textColor = msg.type === "assistant" ? chalk.white : chalk.dim;
    return `${typeColor(msg.type)}: ${textColor(`"${text}"`)}`;
  }

  if (first.type === "tool_use") {
    const toolName = (first.name as string) || "unknown";
    const prefix = `${msg.type}: ${toolName} `;
    const params = first.input
      ? truncateToFit(JSON.stringify(first.input), prefix.length, indent, termWidth)
      : "";
    return `${typeColor(msg.type)}: ${chalk.blue(toolName)} ${chalk.dim(params)}`;
  }

  if (first.type === "tool_result") {
    let preview = "";
    if (typeof first.content === "string") {
      preview = first.content.replace(/\s+/g, " ");
    } else if (Array.isArray(first.content)) {
      const inner = first.content[0] as { text?: string } | undefined;
      if (inner?.text) preview = inner.text.replace(/\s+/g, " ");
    }
    if (preview) {
      const prefix = `${msg.type}: tool_result `;
      return `${typeColor(msg.type)}: ${chalk.yellow("tool_result")} ${chalk.dim(`"${truncateToFit(preview, prefix.length + 2, indent, termWidth)}"`)}`;
    }
    return `${typeColor(msg.type)}: ${chalk.yellow("tool_result")} ${chalk.dim("(ok)")}`;
  }

  return `${typeColor(msg.type)}: ${chalk.dim(String(first.type))}`;
};
