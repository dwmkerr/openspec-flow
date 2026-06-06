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
//
// Every renderer appends `renderRunLink()` so the reader can jump
// straight to the workflow run. The link is omitted automatically
// when not in an Action context (Probot in-proc, local CLI runs).

import { renderRunLink } from "./run-link.js";

const WORKING_GIF_URL =
  "https://raw.githubusercontent.com/dwmkerr/openspec-flow/main/assets/openspec-flow-working.gif";

// HTML <img> (not markdown image) so GitHub honours the width — the
// raw GIF renders ~300px otherwise, dominating the comment. align=left
// floats it beside the text rather than stacking on its own line.
const working = (text: string): string =>
  `<img src="${WORKING_GIF_URL}" width="56" align="left" alt="working" /> ${text}`;

// Suffix every rendered body with a watch-the-run link when one is
// available. Body is regenerated each state mutation, so the link
// updates in lockstep — no separate edit needed.
const withRunLink = (body: string): string => `${body}${renderRunLink()}`;

export const statusReceived = (intentSummary: string): string =>
  withRunLink(working(`openspec-flow received: ${intentSummary}. Starting…`));

export const statusReadingIssue = (issueNumber: number): string =>
  withRunLink(working(`reading context for issue #${issueNumber}…`));

export const statusReadingPr = (prNumber: number): string =>
  withRunLink(working(`reading review context for PR #${prNumber}…`));

export const statusImplementing = (changeName: string, issueNumber: number): string =>
  withRunLink(working(`implementing change \`${changeName}\` for issue #${issueNumber}…`));

export const statusPushing = (): string =>
  withRunLink(working(`agent finished, pushing branch…`));

export const statusSpecPrOpened = (prNumber: number): string =>
  withRunLink(`✅ spec PR opened: #${prNumber}`);

export const statusImplPrOpened = (prNumber: number): string =>
  withRunLink(`✅ impl PR opened: #${prNumber}`);

export const statusSpecUpdated = (): string => withRunLink(`✅ spec updated by openspec-flow`);

export const statusImplUpdated = (): string => withRunLink(`✅ impl updated by openspec-flow`);

export const statusFailure = (error: string): string =>
  withRunLink(`⚠️ openspec-flow failed: ${error}. See dev logs for trace.`);
