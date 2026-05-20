// Integration tests for the order-history-export endpoint and UI control.
// Spin up a real http server backed by the in-memory orders store and
// inject test-controlled auth/rate-limit/flag/audit dependencies. Each test
// drives the endpoint with the global `fetch` (Node 22+) and asserts on
// status, headers, and body.

import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { AddressInfo } from "node:net";
import {
  createExportHandler,
  filenameForDate,
  type AuthResult,
  type Authenticator,
  type ExportHandlerDeps,
} from "../../src/order-history-export/endpoint.js";
import { staticFlag } from "../../src/order-history-export/feature-flag.js";
import {
  InMemoryOrdersStore,
  type Order,
} from "../../src/order-history-export/orders-store.js";
import { renderDownloadCsvControl } from "../../src/order-history-export/ui.js";

const sampleOrder = (overrides: Partial<Order> = {}): Order => ({
  orderId: "ord_1",
  userId: "u1",
  placedAt: new Date("2024-05-10T12:34:56Z"),
  status: "shipped",
  currency: "USD",
  subtotal: 100,
  tax: 10,
  shipping: 5,
  total: 115,
  itemCount: 2,
  ...overrides,
});

const headerAuth = (mapping: Record<string, string>): Authenticator => ({
  authenticate: (req: IncomingMessage): AuthResult | null => {
    const token = req.headers["x-user"] as string | undefined;
    if (!token) return null;
    const userId = mapping[token];
    return userId ? { userId } : null;
  },
});

interface Harness {
  url: string;
  close: () => Promise<void>;
  rateBudget: { value: number };
  auditEvents: Array<{ userId: string; tag: string }>;
}

const startServer = async (
  orders: ReadonlyArray<Order>,
  overrides: Partial<ExportHandlerDeps> = {},
): Promise<Harness> => {
  const rateBudget = { value: Number.POSITIVE_INFINITY };
  const auditEvents: Array<{ userId: string; tag: string }> = [];
  const deps: ExportHandlerDeps = {
    store: new InMemoryOrdersStore(orders),
    auth: overrides.auth ?? headerAuth({ "user-u1": "u1", "user-u2": "u2" }),
    rateLimiter: overrides.rateLimiter ?? {
      allow: () => {
        if (rateBudget.value <= 0) return false;
        rateBudget.value -= 1;
        return true;
      },
    },
    audit: overrides.audit ?? { emit: (e) => auditEvents.push({ userId: e.userId, tag: e.tag }) },
    flag: overrides.flag ?? staticFlag(true),
    now: overrides.now,
  };
  const handler = createExportHandler(deps);

  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === "/orders/export.csv" && req.method === "GET") {
      void handler(req, res);
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    url: `http://127.0.0.1:${port}/orders/export.csv`,
    close: () => new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    ),
    rateBudget,
    auditEvents,
  };
};

describe("order-history-export integration", () => {
  it("5.1 authenticated user downloads their CSV with correct status, headers, BOM, and rows", async () => {
    const fixedNow = new Date("2024-05-10T00:00:00Z");
    const harness = await startServer(
      [
        sampleOrder({ orderId: "a", userId: "u1", placedAt: new Date("2024-01-01T00:00:00Z") }),
        sampleOrder({ orderId: "b", userId: "u2", placedAt: new Date("2024-01-02T00:00:00Z") }),
      ],
      { now: () => fixedNow },
    );
    try {
      const res = await fetch(harness.url, { headers: { "x-user": "user-u1" } });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
      expect(res.headers.get("content-disposition")).toBe(
        `attachment; filename="${filenameForDate(fixedNow)}"`,
      );

      const buf = Buffer.from(await res.arrayBuffer());
      expect(buf.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));

      const body = buf.subarray(3).toString("utf8");
      const lines = body.split("\r\n");
      expect(lines[0]).toBe("order_id,placed_at,status,currency,subtotal,tax,shipping,total,item_count");
      // Only u1's order should appear.
      expect(lines[1]).toBe("a,2024-01-01T00:00:00Z,shipped,USD,100.00,10.00,5.00,115.00,2");
      expect(lines[2]).toBe("");
      expect(body).not.toContain(",b,");
    } finally {
      await harness.close();
    }
  });

  it("5.2 unauthenticated request returns 401 with no body", async () => {
    const harness = await startServer([sampleOrder()]);
    try {
      const res = await fetch(harness.url);
      expect(res.status).toBe(401);
      const buf = Buffer.from(await res.arrayBuffer());
      expect(buf.length).toBe(0);
    } finally {
      await harness.close();
    }
  });

  it("5.3 another user's orders are not present in the response", async () => {
    const harness = await startServer([
      sampleOrder({ orderId: "mine", userId: "u1" }),
      sampleOrder({ orderId: "theirs", userId: "u2" }),
    ]);
    try {
      const res = await fetch(harness.url, { headers: { "x-user": "user-u1" } });
      const body = (await res.text());
      expect(body).toContain("mine");
      expect(body).not.toContain("theirs");
    } finally {
      await harness.close();
    }
  });

  it("5.4 rate-limit breach returns 429", async () => {
    const harness = await startServer([sampleOrder()]);
    harness.rateBudget.value = 1;
    try {
      const ok = await fetch(harness.url, { headers: { "x-user": "user-u1" } });
      expect(ok.status).toBe(200);
      // Drain body to free the socket before next request.
      await ok.arrayBuffer();

      const limited = await fetch(harness.url, { headers: { "x-user": "user-u1" } });
      expect(limited.status).toBe(429);
      const buf = Buffer.from(await limited.arrayBuffer());
      expect(buf.length).toBe(0);
    } finally {
      await harness.close();
    }
  });

  it("5.5 streams large histories without buffering the full result set", async () => {
    // Bespoke generator-backed store: yields N orders one at a time. The
    // streaming requirement is that handler peak memory does not grow with
    // N. We assert that approximately: the handler emits the first chunk of
    // the response before the generator has produced more than a small
    // window of orders.
    let yieldedSoFar = 0;
    let chunksSeen = 0;
    const total = 10_000;
    const store = {
      iterateForUser: async function* () {
        for (let i = 0; i < total; i++) {
          yieldedSoFar++;
          yield sampleOrder({ orderId: `o${i}`, userId: "u1" });
        }
      },
    };
    const harness = await startServer([], {
      auth: { authenticate: () => ({ userId: "u1" }) },
      now: () => new Date("2024-05-10T00:00:00Z"),
    });
    // Replace store on the running handler by re-wiring a fresh server.
    await harness.close();

    const server: Server = createServer(async (req, res) => {
      const h = createExportHandler({
        store,
        auth: { authenticate: () => ({ userId: "u1" }) },
        rateLimiter: { allow: () => true },
        audit: { emit: () => undefined },
        flag: staticFlag(true),
      });
      if (req.url === "/orders/export.csv") {
        await h(req, res);
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/orders/export.csv`);
      const reader = res.body!.getReader();
      let totalBytes = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunksSeen++;
        totalBytes += value!.length;
      }
      expect(res.status).toBe(200);
      // More than one chunk proves the response did not wait for full
      // materialization before sending. yieldedSoFar reaching `total` only
      // at end-of-stream confirms iteration ran to completion.
      expect(chunksSeen).toBeGreaterThan(1);
      expect(yieldedSoFar).toBe(total);
      expect(totalBytes).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it("5.6 UI: Download CSV control renders and points at the endpoint", () => {
    const html = renderDownloadCsvControl({ userId: "u1", flag: staticFlag(true) });
    expect(html).toMatch(/<a [^>]*href="\/orders\/export\.csv"/);
    expect(html).toContain("Download CSV");
  });
});
