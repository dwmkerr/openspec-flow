// Resolve the URL of the current GitHub Actions workflow run from
// the runner's standard env. Returns null when not in an Action
// context (Probot in-proc, local CLI runs) so callers can omit the
// "Watch" line cleanly instead of rendering a broken link.

export const currentRunUrl = (
  env: NodeJS.ProcessEnv = process.env,
): string | null => {
  const server = env.GITHUB_SERVER_URL ?? "https://github.com";
  const repo = env.GITHUB_REPOSITORY;
  const id = env.GITHUB_RUN_ID;
  if (!repo || !id) return null;
  return `${server}/${repo}/actions/runs/${id}`;
};

// Markdown line appended to status comment bodies so the reader can
// jump straight to the workflow run. Trailing newline so the line
// joins cleanly with whatever sits above it.
export const renderRunLink = (
  env: NodeJS.ProcessEnv = process.env,
): string => {
  const url = currentRunUrl(env);
  if (!url) return "";
  const id = env.GITHUB_RUN_ID;
  return `\n\n> 🔎 Watch: [run #${id}](${url})`;
};
