# order-history-export Specification

## Purpose
TBD - created by archiving change add-csv-export-order-history. Update Purpose after archive.
## Requirements
### Requirement: CSV export endpoint for the authenticated user's order history
The system SHALL expose `GET /orders/export.csv` that returns the authenticated caller's order history as a CSV file. The response MUST set `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="orders-<YYYYMMDD>.csv"`, where `<YYYYMMDD>` is the UTC date of the request. The endpoint MUST reuse the same authentication, tenant scoping, and rate-limit policy that the orders page uses, and MUST NOT return any order belonging to another user.

#### Scenario: Authenticated user downloads their own orders
- **WHEN** an authenticated user issues `GET /orders/export.csv`
- **THEN** the response status is `200 OK`
- **AND** the `Content-Type` header is `text/csv; charset=utf-8`
- **AND** the `Content-Disposition` header is `attachment; filename="orders-<YYYYMMDD>.csv"` with `<YYYYMMDD>` set to today's UTC date
- **AND** the body contains only orders whose owner is the authenticated user

#### Scenario: Unauthenticated request is rejected
- **WHEN** an unauthenticated client issues `GET /orders/export.csv`
- **THEN** the response status is `401 Unauthorized`
- **AND** no CSV body is returned

#### Scenario: Rate limit exceeded
- **WHEN** an authenticated user exceeds the per-user rate limit for the orders endpoints
- **THEN** the response status is `429 Too Many Requests`
- **AND** no CSV body is returned

### Requirement: RFC 4180 CSV encoding with UTF-8 BOM
Exported files SHALL be encoded as UTF-8 prefixed with a byte-order mark (`EF BB BF`) and serialized per RFC 4180: records terminated by CRLF (`\r\n`); fields containing comma, double-quote, CR, or LF wrapped in double quotes; embedded double quotes escaped by doubling. The first record MUST be a header row containing the column names in the order defined by the column-schema requirement.

#### Scenario: File starts with UTF-8 BOM
- **WHEN** the export endpoint returns a CSV body
- **THEN** the first three bytes of the body are `0xEF 0xBB 0xBF`

#### Scenario: Field containing a comma is quoted
- **WHEN** any field value contains a comma
- **THEN** that field is wrapped in double quotes in the output

#### Scenario: Field containing a double quote escapes by doubling
- **WHEN** any field value contains a double-quote character
- **THEN** the field is wrapped in double quotes and each embedded double quote is written as two double quotes

#### Scenario: Records terminate with CRLF
- **WHEN** the CSV body contains more than one record
- **THEN** each record is terminated by `\r\n`

### Requirement: Stable order-level column schema
Exported files SHALL contain exactly the following columns, in this order, with these semantics:

1. `order_id` — opaque string identifier of the order.
2. `placed_at` — ISO 8601 UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`).
3. `status` — the order's current status string.
4. `currency` — ISO 4217 three-letter code.
5. `subtotal` — decimal string in `currency`, dot decimal separator, no thousands separator.
6. `tax` — decimal string, same formatting rules as `subtotal`.
7. `shipping` — decimal string, same formatting rules as `subtotal`.
8. `total` — decimal string, same formatting rules as `subtotal`.
9. `item_count` — integer count of line items in the order.

#### Scenario: Header row matches the schema exactly
- **WHEN** the export endpoint returns a CSV body
- **THEN** the first record after the BOM is `order_id,placed_at,status,currency,subtotal,tax,shipping,total,item_count`

#### Scenario: Timestamps use ISO 8601 UTC
- **WHEN** the export contains an order placed at any local time
- **THEN** the `placed_at` field is rendered in UTC using the form `YYYY-MM-DDTHH:MM:SSZ`

#### Scenario: Money fields use dot decimal and no thousands separator
- **WHEN** the export contains a monetary value such as one thousand two hundred thirty-four point five
- **THEN** the value is rendered as `1234.50` regardless of the user's locale

### Requirement: CSV injection mitigation
The system SHALL neutralize fields whose first character would be interpreted as a formula by spreadsheet applications. Any field value beginning with `=`, `+`, `-`, or `@` MUST be prefixed with a single quote (`'`) before standard RFC 4180 quoting is applied.

#### Scenario: Field beginning with `=` is neutralized
- **WHEN** an order field value begins with `=`
- **THEN** the emitted CSV field begins with `'=` (inside quotes if quoting is otherwise required)

### Requirement: Streamed response for large histories
The system SHALL stream the CSV response so that server memory usage is bounded independently of the number of orders exported. The implementation MUST NOT materialize the entire result set in memory before writing the response.

#### Scenario: Large export streams progressively
- **WHEN** an authenticated user with a large order history issues `GET /orders/export.csv`
- **THEN** the server writes the response body progressively as orders are read from the orders store
- **AND** peak server memory for the request does not scale linearly with the number of exported orders

### Requirement: "Download CSV" affordance on the orders page
The orders page SHALL display a "Download CSV" action visible to the authenticated user viewing their own orders. Activating the action MUST trigger a browser download of `GET /orders/export.csv`.

#### Scenario: Authenticated user sees the action
- **WHEN** an authenticated user loads the orders page
- **THEN** a "Download CSV" control is present on the page

#### Scenario: Activating the action downloads the CSV
- **WHEN** the user activates the "Download CSV" control
- **THEN** the browser issues `GET /orders/export.csv`
- **AND** the resulting response is offered to the user as a file download

