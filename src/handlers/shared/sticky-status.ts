// Sticky status comment helpers.
//
// The sticky status comment is the canonical "what's openspec-flow
// doing right now" surface on the target issue/PR. It's mutated
// through the lifecycle of an actionable intent — `received` →
// `reading context` → `implementing change` → `pushing` → terminal.
//
// Two writers collaborate on the same comment:
//
//   1. Probot adapter — posts the initial `received` body pre-gate
//      (sub-second feedback) when an actionable intent is classified.
//   2. Workflow runDispatch — upserts the same marker as it progresses
//      through handler states. Idempotent with the bot's pre-post:
//      the marker substring is the shared lookup key.
//
// Marker shape mirrors the issue-breadcrumb pattern:
//
//   <!-- openspec-flow:sticky intent=create-spec target=42 -->
//
// Each (intent, target) pair gets its own marker so iterating on the
// same PR (iterate-spec re-applied) opens a fresh sticky rather than
// editing the previous one.

import {
  upsertCommentByMarker,
  type UpsertOctokit,
  type UpsertLogger,
} from "./comment-upsert.js";

export const stickyMarker = (intentKind: string, targetNumber: number): string =>
  `<!-- openspec-flow:sticky intent=${intentKind} target=${targetNumber} -->`;

export interface UpsertStickyResult {
  commentId: number | null;
  created: boolean;
}

// Upsert a sticky status comment by its marker. Body should be one
// of the renderers in `status-bodies.ts`; the marker is appended
// here so callers don't have to remember to embed it.
export const upsertStickyComment = async (
  octokit: UpsertOctokit,
  owner: string,
  repo: string,
  targetNumber: number,
  intentKind: string,
  body: string,
  log?: UpsertLogger,
): Promise<UpsertStickyResult> => {
  const marker = stickyMarker(intentKind, targetNumber);
  const composed = body.includes(marker) ? body : `${body}\n\n${marker}`;
  const res = await upsertCommentByMarker(
    octokit,
    owner,
    repo,
    targetNumber,
    marker,
    composed,
    log,
  );
  return { commentId: res.commentId, created: res.created };
};
