// Render the lifecycle sticky comment for every state into a PNG
// approximating GitHub's comment look-and-feel. Output goes to
// docs/previews/sticky-<state>.png.
//
// Same renderer the runtime uses. The markdown source is wrapped in
// an HTML page that pulls GitHub's primer-css + marked.js from CDN
// at render time and Playwright screenshots the resulting container.
//
// Run: npx tsx scripts/preview-sticky.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { renderLifecycleSticky } from "../src/handlers/shared/lifecycle-sticky.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_DIR = join(REPO_ROOT, "docs", "previews");
mkdirSync(OUT_DIR, { recursive: true });

const REPO = { owner: "dwmkerr", name: "livedown" };
const SPEC_RUN = {
  number: 234,
  url: "https://github.com/dwmkerr/livedown/actions/runs/27071518486",
};
const SPEC_ITER_RUN = {
  number: 240,
  url: "https://github.com/dwmkerr/livedown/actions/runs/27071540577",
};
const IMPL_RUN = {
  number: 245,
  url: "https://github.com/dwmkerr/livedown/actions/runs/27072133787",
};
const IMPL_ITER_RUN = {
  number: 251,
  url: "https://github.com/dwmkerr/livedown/actions/runs/27072309997",
};
const FAIL_RUN = {
  number: 23,
  url: "https://github.com/dwmkerr/livedown/actions/runs/26997970496",
};

const FIXTURES = [
  {
    slug: "01-pregate-preparing-spec",
    label: "Pre-gate: just labeled, agent preparing to create spec (no run id yet)",
    issueNumber: 130,
    state: {
      repo: REPO,
      spec: { kind: "preparing" },
      implementation: { kind: "not-started" },
    },
  },
  {
    slug: "02-spec-creating",
    label: "Workflow running, agent creating the spec",
    issueNumber: 130,
    state: {
      repo: REPO,
      spec: { kind: "creating", run: SPEC_RUN },
      implementation: { kind: "not-started" },
    },
  },
  {
    slug: "03-spec-pr-awaiting-review",
    label: "Spec PR open, awaiting review",
    issueNumber: 130,
    state: {
      repo: REPO,
      spec: { kind: "pr-open", prNumber: 137 },
      implementation: { kind: "not-started" },
    },
  },
  {
    slug: "04-spec-pr-iterating",
    label: "Spec PR iterating from review comments",
    issueNumber: 130,
    state: {
      repo: REPO,
      spec: { kind: "pr-iterating", prNumber: 137, run: SPEC_ITER_RUN },
      implementation: { kind: "not-started" },
    },
  },
  {
    slug: "05-impl-creating",
    label: "Spec merged, agent creating the implementation",
    issueNumber: 130,
    state: {
      repo: REPO,
      spec: { kind: "pr-merged", prNumber: 137 },
      implementation: { kind: "creating", run: IMPL_RUN },
    },
  },
  {
    slug: "06-impl-pr-awaiting-review",
    label: "Implementation PR open, awaiting review",
    issueNumber: 130,
    state: {
      repo: REPO,
      spec: { kind: "pr-merged", prNumber: 137 },
      implementation: { kind: "pr-open", prNumber: 138 },
    },
  },
  {
    slug: "07-impl-pr-iterating",
    label: "Implementation PR iterating from review comments",
    issueNumber: 130,
    state: {
      repo: REPO,
      spec: { kind: "pr-merged", prNumber: 137 },
      implementation: { kind: "pr-iterating", prNumber: 138, run: IMPL_ITER_RUN },
    },
  },
  {
    slug: "08-failed",
    label: "Run failed during implementation",
    issueNumber: 130,
    state: {
      repo: REPO,
      spec: { kind: "pr-merged", prNumber: 137 },
      implementation: { kind: "failed" },
      failure: {
        phase: "implementation",
        reason: "git push rejected",
        run: FAIL_RUN,
      },
    },
  },
  {
    slug: "09-completed",
    label: "Completed - both phases merged, issue closes",
    issueNumber: 130,
    state: {
      repo: REPO,
      spec: { kind: "pr-merged", prNumber: 137 },
      implementation: { kind: "pr-merged", prNumber: 138 },
    },
  },
];

const htmlTemplate = (markdown, label) => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${label}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5/github-markdown-light.css" />
<script src="https://cdn.jsdelivr.net/npm/marked@13/marked.min.js"></script>
<style>
  body {
    margin: 0;
    padding: 24px;
    background: #f6f8fa;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #1f2328;
  }
  .label {
    font-size: 12px;
    color: #57606a;
    margin-bottom: 12px;
  }
  .comment {
    border: 1px solid #d0d7de;
    border-radius: 6px;
    background: #ffffff;
    max-width: 960px;
    overflow: hidden;
  }
  .header {
    padding: 8px 16px;
    background: #f6f8fa;
    border-bottom: 1px solid #d0d7de;
    font-size: 13px;
    color: #57606a;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6f42c1, #2188ff);
  }
  .name {
    color: #1f2328;
    font-weight: 600;
  }
  .bot-badge {
    border: 1px solid #d0d7de;
    border-radius: 12px;
    padding: 0 6px;
    font-size: 11px;
    color: #57606a;
  }
  .markdown-body {
    padding: 16px;
    box-sizing: border-box;
    width: 100%;
  }
  .markdown-body table {
    width: auto;
    min-width: 360px;
  }
</style>
</head>
<body>
<div class="label">${label}</div>
<div class="comment">
  <div class="header">
    <div class="avatar"></div>
    <span class="name">openspec-flow-dev</span>
    <span class="bot-badge">bot</span>
    <span>commented now</span>
  </div>
  <article class="markdown-body" id="body"></article>
</div>
<script>
  window.__md = ${JSON.stringify(markdown)};
  document.getElementById("body").innerHTML = marked.parse(window.__md);
</script>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1200 } });
const summaries = [];

for (const fx of FIXTURES) {
  const md = renderLifecycleSticky(fx.issueNumber, fx.state);
  const html = htmlTemplate(md, fx.label);
  const htmlPath = join(OUT_DIR, `${fx.slug}.html`);
  writeFileSync(htmlPath, html, "utf8");
  await page.goto("file://" + htmlPath);
  await page.waitForFunction(() => document.querySelector("#body")?.innerHTML?.length > 0);
  await page.evaluate(() => {
    const wrap = document.createElement("div");
    wrap.style.cssText = "padding:24px;background:#f6f8fa;display:inline-block";
    const label = document.querySelector(".label");
    const comment = document.querySelector(".comment");
    if (label && comment && label.parentNode === document.body) {
      wrap.appendChild(label);
      wrap.appendChild(comment);
      document.body.appendChild(wrap);
    }
  });
  const capture = page.locator("body > div").last();
  const pngPath = join(OUT_DIR, `${fx.slug}.png`);
  await capture.screenshot({ path: pngPath });
  summaries.push({ slug: fx.slug, label: fx.label, png: pngPath });
  console.log(`✓ ${fx.slug}`);
}

await browser.close();

const indexHtml = `<!doctype html>
<html><head>
<meta charset="utf-8" />
<title>openspec-flow sticky comment previews</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; background: #f6f8fa; }
  h1 { font-size: 20px; margin-bottom: 24px; }
  .row { margin-bottom: 40px; }
  .row h2 { font-size: 14px; color: #57606a; margin-bottom: 8px; font-weight: 600; }
  img { border: 1px solid #d0d7de; border-radius: 6px; max-width: 100%; }
</style>
</head>
<body>
<h1>openspec-flow sticky comment — every state</h1>
${summaries
  .map(
    (s) => `<div class="row">
  <h2>${s.label}</h2>
  <img src="${s.slug}.png" alt="${s.label}" />
</div>`,
  )
  .join("\n")}
</body></html>`;

writeFileSync(join(OUT_DIR, "index.html"), indexHtml, "utf8");
console.log(`\nOpen file://${join(OUT_DIR, "index.html")} to review.`);
