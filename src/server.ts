// Boots Probot programmatically so `tsx watch` can hot-reload the whole stack.
// Loads .env, registers the app function from ./index, and listens on PORT.

import "dotenv/config";
import { readFileSync } from "node:fs";
import { Probot, Server } from "probot";
import app from "./index.js";
import { buildLogger } from "./logger.js";

const requiredEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in .env`);
  return v;
};

const privateKeyPath = process.env.PRIVATE_KEY_PATH ?? "./private-key.pem";

// One logger shared by Probot and the Server. When LOG_PATH is set,
// the logger dual-streams: pretty to stdout (dev pane) AND raw JSON
// to the file (post-mortem / grepping).
const log = buildLogger();

const probot = new Probot({
  appId: requiredEnv("APP_ID"),
  privateKey: readFileSync(privateKeyPath, "utf8"),
  secret: requiredEnv("WEBHOOK_SECRET"),
  log,
});

const server = new Server({
  Probot: Probot.defaults({
    appId: requiredEnv("APP_ID"),
    privateKey: readFileSync(privateKeyPath, "utf8"),
    secret: requiredEnv("WEBHOOK_SECRET"),
    log,
  }),
  port: Number(process.env.PORT ?? 3000),
  host: "127.0.0.1",
  log,
});

server.load(app).then(() => server.start());

// Keep `probot` referenced so the type-checker doesn't drop the import.
void probot;
