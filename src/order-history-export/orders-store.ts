// Orders-store iterator and row projection for CSV export.
//
// The store is fronted by an async iterator so callers can stream rows
// without materializing the full result set. The projection enforces the
// v1 column schema and locale-independent formatting (ISO 8601 UTC for
// timestamps, dot-decimal money strings without thousands separators).

export interface Order {
  readonly orderId: string;
  readonly userId: string;
  readonly placedAt: Date;
  readonly status: string;
  readonly currency: string;
  readonly subtotal: number;
  readonly tax: number;
  readonly shipping: number;
  readonly total: number;
  readonly itemCount: number;
}

export interface OrdersStore {
  // Yields the caller's orders in placed-at ascending order. Implementations
  // should stream from the underlying datastore rather than buffer.
  iterateForUser(userId: string): AsyncIterable<Order>;
}

export const ORDER_COLUMNS = [
  "order_id",
  "placed_at",
  "status",
  "currency",
  "subtotal",
  "tax",
  "shipping",
  "total",
  "item_count",
] as const;

const pad2 = (n: number): string => n.toString().padStart(2, "0");

export const formatIsoUtc = (d: Date): string =>
  `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` +
  `T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}Z`;

// Money is rendered with exactly two fractional digits, dot decimal, no
// thousands separator. Avoid Number.toLocaleString — locale-dependent.
export const formatMoney = (value: number): string => value.toFixed(2);

export const projectOrder = (o: Order): ReadonlyArray<string | number> => [
  o.orderId,
  formatIsoUtc(o.placedAt),
  o.status,
  o.currency,
  formatMoney(o.subtotal),
  formatMoney(o.tax),
  formatMoney(o.shipping),
  formatMoney(o.total),
  o.itemCount,
];

// In-memory store useful for prototypes and tests. Production replaces
// this with a streaming database cursor matching the same interface.
export class InMemoryOrdersStore implements OrdersStore {
  constructor(private readonly orders: ReadonlyArray<Order>) {}

  async *iterateForUser(userId: string): AsyncIterable<Order> {
    const filtered = this.orders
      .filter((o) => o.userId === userId)
      .slice()
      .sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());
    for (const o of filtered) yield o;
  }
}
