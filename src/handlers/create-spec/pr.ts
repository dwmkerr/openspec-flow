// Build the spec PR body — short summary + Refs line + the
// auto-maintained metadata HTML comment block per CLAUDE.md.
//
// Uses `Refs #N` (not `Closes #N`) so merging a spec PR does NOT
// auto-close the originating issue — only the impl PR should do that.

export interface SpecPrBodyOpts {
  issueNumber: number;
  changeName: string;
  summary: string;
}

export const buildSpecPrBody = (opts: SpecPrBodyOpts): string => {
  const head = opts.summary
    ? opts.summary
    : `Spec PR for issue #${opts.issueNumber}.`;
  return `${head}\n\nRefs #${opts.issueNumber}.\n\n<!-- openspec-flow:auto-maintained — do not remove or edit\nissue: ${opts.issueNumber}\nkind: spec\nchange: ${opts.changeName}\n-->\n`;
};
