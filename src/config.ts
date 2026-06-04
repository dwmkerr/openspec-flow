// Runtime configuration knobs read from the environment.
//
// Kept separate from the adapters so unit tests can stub via env without
// reaching into module internals.

export type DispatchMode = "in-process" | "action";

// `in-process` makes the Probot adapter route issue/PR events through
// runDispatch directly. `action` (the default) makes Probot no-op those
// events so the shim workflow in the user's repo is the sole dispatcher.
// `installation.created` ignores this flag — only Probot can see it.
export const dispatchMode = (env: NodeJS.ProcessEnv = process.env): DispatchMode =>
  env.OPENSPEC_FLOW_DISPATCH_MODE === "in-process" ? "in-process" : "action";
