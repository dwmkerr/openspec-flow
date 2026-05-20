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

// pino-http (Probot wraps it) defaults to dumping the whole req:
// headers (16+ keys), query, params, remoteAddress, remotePort —
// ~25 lines per webhook in pretty output, dominating the pane.
// Keep just the fields that aid grepping back to a delivery.
const serializers = {
  req: (req: { id?: string; method?: string; url?: string }) => ({
    id: req.id,
    method: req.method,
    url: req.url,
  }),
};

export const buildLogger = (): Logger => {
  const logPath = process.env.LOG_PATH;

  // pino-pretty options shared by both single- and dual-stream
  // configs. Dropping pid + hostname + name collapses the per-line
  // prefix to exactly `[HH:MM:SS.mmm] LEVEL: ` — 22 chars at its
  // widest. That fixed width lets src/agent/format-chunk.ts size
  // its truncation deterministically (see PINO_PREFIX_RESERVE
  // there). If you change this `ignore` list, update that constant.
  //
  // `req` is dropped because pino-http (which Probot wraps) emits
  // it on every webhook with full headers + query + params — ~25
  // pretty lines per request. The msg already conveys what matters
  // (`POST /api/github/webhooks 200 - 3ms`); the raw req object
  // is still captured in the JSON file when LOG_PATH is set.
  const prettyOptions = {
    destination: 1,
    ignore: "pid,hostname,name,req",
  };

  if (!logPath) {
    return pino({
      level,
      serializers,
      transport: { target: "pino-pretty", options: prettyOptions },
    });
  }

  // Dual stream: pretty on stdout for the dev pane, raw JSON to the
  // file. `mkdir: true` ensures `logs/` exists on first write.
  return pino({
    level,
    serializers,
    transport: {
      targets: [
        { target: "pino-pretty", options: prettyOptions, level },
        { target: "pino/file", options: { destination: logPath, mkdir: true }, level },
      ],
    },
  });
};
