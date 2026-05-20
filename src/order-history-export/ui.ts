// HTML fragment for the "Download CSV" affordance on the orders page.
//
// Rendered server-side and injected into the orders-page template. The
// control is a plain <a> with an href pointing at the export endpoint —
// the browser handles the download natively from the
// `Content-Disposition: attachment` response header. No JS required.

import type { FeatureFlag } from "./feature-flag.js";

export const EXPORT_ENDPOINT_PATH = "/orders/export.csv";

export interface OrdersPageContext {
  readonly userId: string | null;
  readonly flag: FeatureFlag;
}

const ANCHOR = (
  `<a class="orders-export" data-testid="download-csv" href="${EXPORT_ENDPOINT_PATH}" download>` +
  `Download CSV` +
  `</a>`
);

export const renderDownloadCsvControl = (ctx: OrdersPageContext): string => {
  if (ctx.userId === null) return "";
  // Hide the affordance entirely when the flag is off so unauthenticated UA
  // sniffing cannot discover the endpoint via the markup.
  if (!ctx.flag.isEnabled(ctx.userId)) return "";
  return ANCHOR;
};
