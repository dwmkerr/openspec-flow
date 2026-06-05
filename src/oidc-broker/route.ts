// Express middleware adapter for the OIDC broker. Mounted at
// /api/token by the Probot app function.

import type { Request, Response } from "express";
import { broker, type BrokerConfig, type InstallationTokenIssuer } from "./index.js";

export interface RouteDeps {
  config: BrokerConfig;
  issuer: InstallationTokenIssuer;
  log: { info: (m: string) => void; warn: (m: string) => void };
}

const readBearer = (req: Request): string | null => {
  const auth = req.headers.authorization;
  if (!auth) return null;
  // Case-insensitive 'Bearer' per RFC 6750; runner emits lowercase.
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

export const handleTokenRequest = (deps: RouteDeps) =>
  async (req: Request, res: Response): Promise<void> => {
    const idToken = readBearer(req);
    const result = await broker(idToken, deps.config, deps.issuer, deps.log);
    if ("token" in result) {
      res.status(200).json(result);
      return;
    }
    res.status(result.status).json({ error: result.error });
  };
