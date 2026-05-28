// Builders for status comment bodies. Centralised so the working /
// terminal visuals stay consistent across handlers.
//
// Working states embed the animated GIF inline at the left of the
// line — gives the comment a visible "in flight" signal even before
// the reviewer reads the text. Terminal states drop the GIF and use
// a static emoji so the comment "stops moving" once work stops.
//
// The GIF URL points at the openspec-flow main branch's raw asset.
// If the repo is private, GitHub Camo won't proxy unauthenticated
// requests and the GIF will appear broken to readers without access
// — acceptable trade-off while the repo is private; fix later by
// hosting on a CDN or making the assets public.

const WORKING_GIF_URL =
  "https://raw.githubusercontent.com/dwmkerr/openspec-flow/main/assets/openspec-flow-working.gif";

const working = (text: string): string =>
  `![working](${WORKING_GIF_URL}) ${text}`;

export const statusReceived = (intentSummary: string): string =>
  working(`openspec-flow received: ${intentSummary}. Starting…`);

export const statusReadingIssue = (issueNumber: number): string =>
  working(`reading context for issue #${issueNumber}…`);

export const statusReadingPr = (prNumber: number): string =>
  working(`reading review context for PR #${prNumber}…`);

export const statusImplementing = (changeName: string, issueNumber: number): string =>
  working(`implementing change \`${changeName}\` for issue #${issueNumber}…`);

export const statusPushing = (): string =>
  working(`agent finished, pushing branch…`);

export const statusSpecPrOpened = (prNumber: number): string =>
  `✅ spec PR opened: #${prNumber}`;

export const statusImplPrOpened = (prNumber: number): string =>
  `✅ impl PR opened: #${prNumber}`;

export const statusSpecUpdated = (): string => `✅ spec updated by openspec-flow`;

export const statusImplUpdated = (): string => `✅ impl updated by openspec-flow`;

export const statusFailure = (error: string): string =>
  `⚠️ openspec-flow failed: ${error}. See dev logs for trace.`;
