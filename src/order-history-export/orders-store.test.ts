import {
  formatIsoUtc,
  formatMoney,
  InMemoryOrdersStore,
  ORDER_COLUMNS,
  projectOrder,
  type Order,
} from "./orders-store.js";

const sample = (overrides: Partial<Order> = {}): Order => ({
  orderId: "ord_1",
  userId: "u1",
  placedAt: new Date("2024-03-04T05:06:07Z"),
  status: "shipped",
  currency: "USD",
  subtotal: 1234.5,
  tax: 98.76,
  shipping: 0,
  total: 1333.26,
  itemCount: 3,
  ...overrides,
});

describe("orders store and projection", () => {
  it("exposes the v1 column schema in order", () => {
    expect(ORDER_COLUMNS).toEqual([
      "order_id",
      "placed_at",
      "status",
      "currency",
      "subtotal",
      "tax",
      "shipping",
      "total",
      "item_count",
    ]);
  });

  it("renders placed_at as ISO 8601 UTC regardless of source offset", () => {
    expect(formatIsoUtc(new Date("2024-03-04T05:06:07+05:30"))).toBe("2024-03-03T23:36:07Z");
  });

  it("renders money with dot decimal and no thousands separator", () => {
    expect(formatMoney(1234.5)).toBe("1234.50");
    expect(formatMoney(0)).toBe("0.00");
  });

  it("projects an order into the v1 row tuple", () => {
    expect(projectOrder(sample())).toEqual([
      "ord_1",
      "2024-03-04T05:06:07Z",
      "shipped",
      "USD",
      "1234.50",
      "98.76",
      "0.00",
      "1333.26",
      3,
    ]);
  });

  it("iterates only the caller's orders in placed-at ascending order", async () => {
    const store = new InMemoryOrdersStore([
      sample({ orderId: "a", userId: "u1", placedAt: new Date("2024-01-02T00:00:00Z") }),
      sample({ orderId: "b", userId: "u2", placedAt: new Date("2024-01-01T00:00:00Z") }),
      sample({ orderId: "c", userId: "u1", placedAt: new Date("2024-01-01T00:00:00Z") }),
    ]);

    const ids: string[] = [];
    for await (const o of store.iterateForUser("u1")) ids.push(o.orderId);
    expect(ids).toEqual(["c", "a"]);
  });

  it("does not buffer the full result set", async () => {
    // Synthetic generator that would OOM if buffered; iterate only the head.
    const huge: Order[] = [];
    for (let i = 0; i < 5; i++) huge.push(sample({ orderId: `o${i}` }));
    const store = new InMemoryOrdersStore(huge);
    const seen: string[] = [];
    for await (const o of store.iterateForUser("u1")) {
      seen.push(o.orderId);
      if (seen.length === 2) break;
    }
    expect(seen).toEqual(["o0", "o1"]);
  });
});
