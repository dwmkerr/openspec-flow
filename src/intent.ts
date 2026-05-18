// Classifies what the bot intends to do given a triggering event.
// Phase 1: just naming and logging — no side effects. Phase 2 wires actions.

export type Intent =
  | { kind: "create-spec"; issueNumber: number; title: string }
  | { kind: "iterate-spec"; prNumber: number }
  | { kind: "iterate-impl"; prNumber: number }
  | { kind: "noop"; reason: string };

export const describe = (i: Intent): string => {
  switch (i.kind) {
    case "create-spec":
      return `create specification for issue #${i.issueNumber} — ${i.title}`;
    case "iterate-spec":
      return `iterate on spec PR #${i.prNumber}`;
    case "iterate-impl":
      return `iterate on implementation PR #${i.prNumber}`;
    case "noop":
      return `noop — ${i.reason}`;
  }
};
