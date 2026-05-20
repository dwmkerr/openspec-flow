import { staticFlag } from "./feature-flag.js";
import { EXPORT_ENDPOINT_PATH, renderDownloadCsvControl } from "./ui.js";

describe("orders page export control", () => {
  it("renders an anchor pointing at the export endpoint for an authenticated user", () => {
    const html = renderDownloadCsvControl({ userId: "u1", flag: staticFlag(true) });
    expect(html).toContain(`href="${EXPORT_ENDPOINT_PATH}"`);
    expect(html).toContain("Download CSV");
    expect(html).toContain('data-testid="download-csv"');
  });

  it("returns an empty string when the feature flag is off", () => {
    expect(renderDownloadCsvControl({ userId: "u1", flag: staticFlag(false) })).toBe("");
  });

  it("returns an empty string for an anonymous viewer", () => {
    expect(renderDownloadCsvControl({ userId: null, flag: staticFlag(true) })).toBe("");
  });
});
