// Build the spec PR body — short summary + Closes line + the
// auto-maintained metadata HTML comment block per CLAUDE.md.

export interface SpecPrBodyOpts {
  issueNumber: number;
  changeName: string;
  summary: string;
}

export const buildSpecPrBody = (opts: SpecPrBodyOpts): string => {
  const head = opts.summary
    ? opts.summary
    : `Spec PR for issue #${opts.issueNumber}.`;
  return `${head}\n\nCloses #${opts.issueNumber}.\n\n<!-- openspec-flow:auto-maintained — do not remove or edit\nissue: ${opts.issueNumber}\nkind: spec\nchange: ${opts.changeName}\n-->\n`;
};
