## 1. CSV serializer

- [ ] 1.1 Add an RFC 4180 CSV writer module that accepts an iterable of row objects and writes to a stream
- [ ] 1.2 Emit a UTF-8 BOM as the first three bytes of output
- [ ] 1.3 Quote fields containing comma, double-quote, CR, or LF; escape embedded double quotes by doubling
- [ ] 1.4 Terminate every record with CRLF (`\r\n`)
- [ ] 1.5 Neutralize CSV injection: prefix field values starting with `=`, `+`, `-`, or `@` with a single quote
- [ ] 1.6 Unit tests covering BOM, quoting, CRLF, escape doubling, and injection neutralization

## 2. Order-export query

- [ ] 2.1 Add an orders-store iterator that yields the authenticated user's orders in placed-at order without buffering the full result set
- [ ] 2.2 Project each order into the v1 column schema (`order_id`, `placed_at`, `status`, `currency`, `subtotal`, `tax`, `shipping`, `total`, `item_count`)
- [ ] 2.3 Render `placed_at` as ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`)
- [ ] 2.4 Render money fields as decimal strings, dot decimal, no thousands separator

## 3. HTTP endpoint

- [ ] 3.1 Add `GET /orders/export.csv` handler that requires the same authentication and tenant scoping as the orders page
- [ ] 3.2 Set `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="orders-<YYYYMMDD>.csv"` with today's UTC date
- [ ] 3.3 Stream the CSV body using the serializer over the order iterator
- [ ] 3.4 Apply the existing per-user rate-limit policy; return HTTP 429 on breach
- [ ] 3.5 Return HTTP 401 for unauthenticated requests
- [ ] 3.6 Emit the same audit-log event shape as the orders-page read path, tagged as `export`

## 4. Orders page UI

- [ ] 4.1 Add a "Download CSV" control on the orders page, visible to the authenticated user
- [ ] 4.2 Wire the control to issue `GET /orders/export.csv` and let the browser handle the download
- [ ] 4.3 Hide the control when the orders-page feature flag for the export is off

## 5. Tests

- [ ] 5.1 Integration test: authenticated user downloads CSV; asserts status, headers, BOM, header row, and that only their orders appear
- [ ] 5.2 Integration test: unauthenticated request returns 401 with no body
- [ ] 5.3 Integration test: another user's orders are not present in the response
- [ ] 5.4 Integration test: rate-limit breach returns 429
- [ ] 5.5 Integration test: streaming — server memory bounded across a large synthetic history
- [ ] 5.6 UI test: "Download CSV" control appears and triggers the endpoint

## 6. Rollout

- [ ] 6.1 Gate the endpoint and UI behind the existing orders-page feature flag
- [ ] 6.2 Enable the flag in staging and run the smoke suite
- [ ] 6.3 Enable in production after smoke passes; document rollback (flip flag off)
