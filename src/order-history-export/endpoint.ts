// HTTP handler for `GET /orders/export.csv`.
//
// Dependencies (auth, rate limit, audit log, orders store, feature flag) are
// injected so production wires real implementations and tests substitute
// fakes. The handler streams CSV directly to the response — no buffering —
// to keep server memory bounded regardless of export size.

import type { IncomingMessage, ServerResponse } from "node:http";
import { writeCsv } from "./csv.js";
import {
  InMemoryOrdersStore,
  ORDER_COLUMNS,
  projectOrder,
  type Order,
  type OrdersStore,
} from "./orders-store.js";
import type { FeatureFlag } from "./feature-flag.js";

export interface AuthResult {
  readonly userId: string;
}

export interface Authenticator {
  // Returns the authenticated user, or null if the request is anonymous.
  authenticate(req: IncomingMessage): AuthResult | null;
}

export interface RateLimiter {
  // Returns true when the call is within the user's budget, false when the
  // policy has been breached for this request.
  allow(userId: string): boolean;
}

export interface AuditEvent {
  readonly userId: string;
  readonly action: string;
  readonly resource: string;
  readonly tag: string;
}

export interface AuditLog {
  emit(event: AuditEvent): void;
}

export interface ExportHandlerDeps {
  readonly store: OrdersStore;
  readonly auth: Authenticator;
  readonly rateLimiter: RateLimiter;
  readonly audit: AuditLog;
  readonly flag: FeatureFlag;
  // Override for tests so filenames are deterministic.
  readonly now?: () => Date;
}

const pad2 = (n: number): string => n.toString().padStart(2, "0");

export const filenameForDate = (d: Date): string => {
  const ymd = `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
  return `orders-${ymd}.csv`;
};

export const createExportHandler = (deps: ExportHandlerDeps) => {
  const now = deps.now ?? (() => new Date());

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const principal = deps.auth.authenticate(req);
    if (!principal) {
      // 401 must carry no CSV body — explicit no-content response.
      res.statusCode = 401;
      res.end();
      return;
    }

    if (!deps.flag.isEnabled(principal.userId)) {
      // Flag-off acts as if the endpoint isn't there.
      res.statusCode = 404;
      res.end();
      return;
    }

    if (!deps.rateLimiter.allow(principal.userId)) {
      res.statusCode = 429;
      res.end();
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filenameForDate(now())}"`,
    );

    deps.audit.emit({
      userId: principal.userId,
      action: "orders.read",
      resource: "/orders/export.csv",
      tag: "export",
    });

    const rows = (async function* () {
      for await (const order of deps.store.iterateForUser(principal.userId)) {
        yield projectOrder(order);
      }
    })();

    await writeCsv(res, { header: ORDER_COLUMNS as unknown as ReadonlyArray<string> }, rows);
    res.end();
  };
};

// Convenience export for tests/prototypes that want a default store wired up.
export const buildPrototypeDeps = (
  orders: ReadonlyArray<Order>,
  overrides: Partial<ExportHandlerDeps> = {},
): ExportHandlerDeps => ({
  store: new InMemoryOrdersStore(orders),
  auth: overrides.auth ?? { authenticate: () => ({ userId: "u1" }) },
  rateLimiter: overrides.rateLimiter ?? { allow: () => true },
  audit: overrides.audit ?? { emit: () => undefined },
  flag: overrides.flag ?? { isEnabled: () => true },
  now: overrides.now,
});
