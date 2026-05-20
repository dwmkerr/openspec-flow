// Build the Probot-compatible pino logger.
//
// Default: pretty stdout, same as before.
// With LOG_PATH set: pretty stdout AND raw JSON to the file (pino
//   multi-target transport). The file captures the full structured
//   record — every field, no truncation — so post-mortems can grep,
//   filter, replay, or feed it to anything that reads pino JSON.
// LOG_PATH supports absolute or repo-relative paths; the directory
// is created with mkdir: true.

import pino, { type Logger } from "pino";

const level = process.env.LOG_LEVEL ?? "info";

export const buildLogger = (): Logger => {
  const logPath = process.env.LOG_PATH;

  if (!logPath) {
    // Probot's default: pretty single stream on stdout. Match it.
    return pino({
      level,
      transport: {
        target: "pino-pretty",
        options: { destination: 1 },
      },
    });
  }

  // Dual stream: pretty on stdout for the dev pane, raw JSON to the
  // file. `mkdir: true` ensures `logs/` exists on first write.
  return pino({
    level,
    transport: {
      targets: [
        { target: "pino-pretty", options: { destination: 1 }, level },
        { target: "pino/file", options: { destination: logPath, mkdir: true }, level },
      ],
    },
  });
};
