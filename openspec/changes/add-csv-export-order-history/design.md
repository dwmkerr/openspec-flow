## Context

The orders page already renders a user's order history from the orders service. Users have asked to pull that history into spreadsheets and accounting tools. The data already exists server-side; what is missing is a serialized export and a UI affordance to trigger it. The export must be safe for non-technical users opening the file in Excel and for programmatic consumers parsing it strictly per RFC 4180.

## Goals / Non-Goals

**Goals:**
- One-click CSV download of the authenticated user's order history from the orders page.
- Output is UTF-8 with a BOM and conforms to RFC 4180.
- Stable, documented column schema suitable for downstream parsing.
- Reuse the orders page's existing auth, rate limiting, and audit logging.
- Streamed response so large histories do not pin server memory.

**Non-Goals:**
- Other formats (XLSX, JSON, PDF).
- Bulk/admin exports across multiple users.
- Custom column selection, filtering UI, or saved export presets.
- Scheduled or emailed exports.
- Export of line-item detail; the v1 schema is order-level only.

## Decisions

### Decision: Server-rendered CSV via a dedicated endpoint
Render CSV on the server at `GET /orders/export.csv` rather than building it from the JSON API in the browser.
- Avoids loading the full history into the client just to re-serialize it.
- Keeps the auth check, rate limit, and audit log in one place.
- Lets us stream rows directly from the orders query.

**Alternative considered:** generate CSV in the browser from the existing JSON list endpoint. Rejected — duplicates serialization logic, forces pagination round-trips, and pushes Excel-quirk handling into the client.

### Decision: UTF-8 with BOM, RFC 4180 strict
Emit a UTF-8 BOM (`EF BB BF`) so Excel on Windows opens the file with the correct encoding, and follow RFC 4180 strictly: CRLF line endings, fields containing comma/quote/CRLF wrapped in double quotes, embedded double quotes doubled.
- Issue explicitly asks for UTF-8 + RFC 4180.
- BOM is the lowest-friction fix for the well-known Excel UTF-8 issue.

**Alternative considered:** UTF-8 without BOM. Rejected — breaks non-ASCII in Excel on Windows for most users, which is the primary consumer.

### Decision: Stable column schema, order-level only
v1 schema: `order_id, placed_at, status, currency, subtotal, tax, shipping, total, item_count`. `placed_at` is ISO 8601 UTC. Money columns are decimal strings in the order's `currency`, no thousands separator, dot decimal.
- Order-level keeps the file flat and Excel-friendly.
- ISO 8601 + dot-decimal are unambiguous across locales.

**Alternative considered:** include per-line-item rows. Rejected for v1 — denormalizes the file, complicates totals, and is not requested in the issue.

### Decision: Streamed response
Write rows directly to the HTTP response as the orders query iterates, with `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="orders-<YYYYMMDD>.csv"`.
- Bounded memory regardless of history size.
- Browser triggers a download immediately on click.

**Alternative considered:** buffer in memory then send. Rejected — unbounded for power users with long histories.

### Decision: Authorization mirrors the orders page
Reuse the same session/auth middleware and tenant scoping as the orders page. The endpoint returns only the authenticated caller's orders. No new role, no admin override.
- Keeps the security surface unchanged.
- A user cannot use the endpoint to read another user's data.

## Risks / Trade-offs

- **Risk:** Excel mis-parses very large numbers or leading-zero IDs → **Mitigation:** `order_id` is treated as a string field; if any future ID looks numeric we'll prefix-quote on write. Document the column types in the spec.
- **Risk:** Long histories produce slow downloads → **Mitigation:** streaming response avoids server memory pressure; client-side it is a normal progressive download. No pagination needed for v1.
- **Risk:** CSV injection (a field starting with `=`, `+`, `-`, `@`) executed as a formula in Excel → **Mitigation:** prefix any such field value with a single quote `'` before quoting, per OWASP guidance.
- **Risk:** Rate-limit abuse (repeatedly hitting the export endpoint) → **Mitigation:** apply the same per-user rate limit bucket already in front of the orders page; reject with HTTP 429 on breach.
- **Trade-off:** Order-level only export means power users who want line items must wait for a v2. Acceptable for the smoke scope.

## Migration Plan

- No data migration. Feature is purely additive: new endpoint, new button.
- Roll out behind the standard feature flag used for orders-page changes; flip on once smoke tests pass in staging.
- Rollback = flip flag off; endpoint stays but UI affordance is hidden.

## Open Questions

- None blocking v1. Future: do we want a JSON export sibling? Out of scope here.
