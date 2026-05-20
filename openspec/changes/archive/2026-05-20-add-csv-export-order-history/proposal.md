## Why

Users currently view order history only in the rendered orders page. They cannot move that data into spreadsheets, accounting tools, or downstream automation without manual copy-paste. A CSV download closes that gap with minimal product surface and no new account/permissions model.

## What Changes

- Add a "Download CSV" action to the orders page that exports the current user's order history.
- Encode output as UTF-8 with a BOM and serialize per RFC 4180 (CRLF line endings, double-quoted fields, escaped embedded quotes).
- Include a stable column schema: `order_id`, `placed_at`, `status`, `currency`, `subtotal`, `tax`, `shipping`, `total`, `item_count`.
- Stream the response from the server so large histories do not buffer entirely in memory.
- Reuse the same authentication and authorization as the orders page — a user can only export their own orders.

## Capabilities

### New Capabilities
- `order-history-export`: CSV export of the authenticated user's order history, exposed from the orders page.

### Modified Capabilities
<!-- None. No existing capability's requirements change. -->

## Impact

- New HTTP endpoint `GET /orders/export.csv` on the orders service.
- New "Download CSV" UI affordance on the orders page.
- No schema changes — exports read from the existing orders store.
- No new dependencies; CSV encoding uses the standard library.
- Auth, rate limiting, and logging follow the patterns already used by the orders page.
