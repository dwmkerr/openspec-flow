# order-history-export

CSV export of the authenticated user's order history. Exposes
`GET /orders/export.csv` and a "Download CSV" affordance on the orders page.

## Module map

| File | Role |
|---|---|
| `csv.ts` | RFC 4180 streaming writer (BOM, CRLF, quoting, injection guard). |
| `orders-store.ts` | Iterator + v1 column projection (ISO 8601 UTC, dot-decimal money). |
| `endpoint.ts` | `GET /orders/export.csv` handler factory with injected auth/rate-limit/audit/flag deps. |
| `ui.ts` | Server-rendered "Download CSV" anchor for the orders page. |
| `feature-flag.ts` | Minimal flag interface; production wires the shared orders-page flag. |

## Rollout

The endpoint and UI are gated by the existing orders-page feature flag
(`FeatureFlag.isEnabled(userId)`). Both surfaces respect the same flag so
that flipping it off in production is a complete rollback:

1. **Staging** — enable the flag, run the smoke suite
   (`npm run test:integration -- order-history-export`), eyeball a
   download in a browser to confirm Excel opens the file with correct
   encoding.
2. **Production** — enable the flag after staging is green. Rollback is
   `flag.disable("orders-export")`: the endpoint returns `404` and the UI
   affordance disappears.
3. **Audit log** — every successful export emits an event tagged `export`
   with the same shape as the orders-page read event, so downstream
   compliance dashboards do not need extra wiring.
