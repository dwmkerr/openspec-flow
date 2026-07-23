# Changelog

## [0.1.8](https://github.com/dwmkerr/openspec-flow/compare/v0.1.7...v0.1.8) (2026-07-23)


### Features

* support Claude Code OAuth in reusable workflow ([#113](https://github.com/dwmkerr/openspec-flow/issues/113)) ([675fbbb](https://github.com/dwmkerr/openspec-flow/commit/675fbbb154d9e32919213ff430207a4cdb8dfed3))

## [0.1.7](https://github.com/dwmkerr/openspec-flow/compare/v0.1.6...v0.1.7) (2026-07-23)


### Bug Fixes

* disable invalid composite action cache path ([#111](https://github.com/dwmkerr/openspec-flow/issues/111)) ([4dfc6e6](https://github.com/dwmkerr/openspec-flow/commit/4dfc6e62088583a9c99579eb61ccd51581bd59c5))

## [0.1.6](https://github.com/dwmkerr/openspec-flow/compare/v0.1.5...v0.1.6) (2026-07-23)


### Bug Fixes

* resolve broker variables before composite action ([#109](https://github.com/dwmkerr/openspec-flow/issues/109)) ([202b12e](https://github.com/dwmkerr/openspec-flow/commit/202b12e96c4971646f79d10ddb3ca8c3115710e4))

## [0.1.5](https://github.com/dwmkerr/openspec-flow/compare/v0.1.4...v0.1.5) (2026-07-10)


### Features

* make App identity opt-in, rename broker_url -&gt; oidc_broker_url ([#107](https://github.com/dwmkerr/openspec-flow/issues/107)) ([9eeec99](https://github.com/dwmkerr/openspec-flow/commit/9eeec99d41802f093f46e7f541f61de28448d832))

## [0.1.4](https://github.com/dwmkerr/openspec-flow/compare/v0.2.0...v0.1.4) (2026-07-09)


### Features

* publish to npm on release ([#101](https://github.com/dwmkerr/openspec-flow/issues/101)) ([b097bae](https://github.com/dwmkerr/openspec-flow/commit/b097bae6d0da95a7b96f2cc374d632a0241a597a))


### Build

* pin pre-1.0 feature releases to the 0.1.x patch line ([#106](https://github.com/dwmkerr/openspec-flow/issues/106)) ([f2d2892](https://github.com/dwmkerr/openspec-flow/commit/f2d2892dbb97f449880135baff2d2737caa30eb8))

## [0.2.0](https://github.com/dwmkerr/openspec-flow/compare/v0.1.0...v0.2.0) (2026-07-09)


### Features

* composite action with Anthropic config passthrough ([#103](https://github.com/dwmkerr/openspec-flow/issues/103)) ([7f09553](https://github.com/dwmkerr/openspec-flow/commit/7f09553e5a07f3fac303a15ff16624d091e6a608))


### Documentation

* propose composite-action packaging for env passthrough ([#102](https://github.com/dwmkerr/openspec-flow/issues/102)) ([67f1c89](https://github.com/dwmkerr/openspec-flow/commit/67f1c898423236bf740464bf7e24817c3ad3de64))

## 0.1.0 (2026-06-17)


### Features

* add openspec-flow brand icon + openspec source assets ([#14](https://github.com/dwmkerr/openspec-flow/issues/14)) ([f308091](https://github.com/dwmkerr/openspec-flow/commit/f308091b7c146cb551b2f4f565db046bd053f74b))
* App-install init PR + CLI app-init + dispatch-mode gate ([#77](https://github.com/dwmkerr/openspec-flow/issues/77)) ([ab739df](https://github.com/dwmkerr/openspec-flow/commit/ab739df72b13461bed0ee499e0769254a16b909e))
* bot pre-gate sticky status comment + marker-based upsert ([#86](https://github.com/dwmkerr/openspec-flow/issues/86)) ([3128910](https://github.com/dwmkerr/openspec-flow/commit/3128910493fb80f4982977dff7c6c0428c9ce3fe))
* consolidated lifecycle sticky comment on the issue ([#87](https://github.com/dwmkerr/openspec-flow/issues/87)) ([8f591e7](https://github.com/dwmkerr/openspec-flow/commit/8f591e7f1561d700416b30c0710cd5e6c7639bf0))
* dispatcher handler registry + iterate-impl + visible noop ([#55](https://github.com/dwmkerr/openspec-flow/issues/55)) ([19a2d86](https://github.com/dwmkerr/openspec-flow/commit/19a2d863d5cea4c08708a356bea4bb7817fa1711))
* eyes reaction ack + test:fixture cleanup ([#9](https://github.com/dwmkerr/openspec-flow/issues/9)) ([0bb00e6](https://github.com/dwmkerr/openspec-flow/commit/0bb00e63e41d73dcb8bce4fbf0bdab19cc0958ee))
* fast 👀 ack on openspec:go + auxiliary install/dev wiring ([#78](https://github.com/dwmkerr/openspec-flow/issues/78)) ([fc4cc47](https://github.com/dwmkerr/openspec-flow/commit/fc4cc473305d75fc1dbc88c0ee4df06fda1e88d7))
* init checks GitHub labels + prints create commands ([#59](https://github.com/dwmkerr/openspec-flow/issues/59)) ([b399888](https://github.com/dwmkerr/openspec-flow/commit/b3998880d6258fe8cec006587ca356aff8cd30aa))
* install prints `gh secret set` example with inline grey hint ([#69](https://github.com/dwmkerr/openspec-flow/issues/69)) ([78eef55](https://github.com/dwmkerr/openspec-flow/commit/78eef55730c47cf1703a542cde8213af48e7dcd3))
* OIDC token broker + Fly deploy + status feedback (end-to-end) ([#83](https://github.com/dwmkerr/openspec-flow/issues/83)) ([0d61b82](https://github.com/dwmkerr/openspec-flow/commit/0d61b82221f3b353121b8a288468ba71351ec6c7))
* openspec-flow init — lean local scaffold ([#52](https://github.com/dwmkerr/openspec-flow/issues/52)) ([8395a21](https://github.com/dwmkerr/openspec-flow/commit/8395a21ec415b00a4df4197f1100fd82f071ec66))
* README managed block opens with workflow-status badge ([#70](https://github.com/dwmkerr/openspec-flow/issues/70)) ([a4c00cb](https://github.com/dwmkerr/openspec-flow/commit/a4c00cb43a2896282760d99de2f5c0523888745b))
* release pipeline + Fly prod deploy ([#95](https://github.com/dwmkerr/openspec-flow/issues/95)) ([20b8c90](https://github.com/dwmkerr/openspec-flow/commit/20b8c9087758ae728665fdaf56ff57ca755eec30))
* rename init → install, add uninstall ([#61](https://github.com/dwmkerr/openspec-flow/issues/61)) ([6a7dd60](https://github.com/dwmkerr/openspec-flow/commit/6a7dd60790e1c9d98deca0dfda1728e28eda3779))
* scaffold probot dev loop with intent classifier ([#3](https://github.com/dwmkerr/openspec-flow/issues/3)) ([0dd88b3](https://github.com/dwmkerr/openspec-flow/commit/0dd88b317f955e7012500474ae9f883a5260f6ae))
* single sticky status comment per actionable intent ([#37](https://github.com/dwmkerr/openspec-flow/issues/37)) ([012351c](https://github.com/dwmkerr/openspec-flow/commit/012351c14ca21979ad4b1d7ab48d2169b7238fe0))
* unified lifecycle sticky — mirror to issue + PRs, install hint, inline step ([#88](https://github.com/dwmkerr/openspec-flow/issues/88)) ([19e4f1a](https://github.com/dwmkerr/openspec-flow/commit/19e4f1a88827e2a9855217a8563f568dd046905a))
* upserted issue lifecycle breadcrumb comment ([#68](https://github.com/dwmkerr/openspec-flow/issues/68)) ([1e6a7e5](https://github.com/dwmkerr/openspec-flow/commit/1e6a7e5bba448b66a9dfede0a5182a238227757e))
* wire Action mode to the Probot dispatcher ([#57](https://github.com/dwmkerr/openspec-flow/issues/57)) ([53caf5e](https://github.com/dwmkerr/openspec-flow/commit/53caf5ec3259d93a06240cfd7b61366511b8bf3e))
* wire Claude Agent SDK runtime + create-spec stub handler ([#11](https://github.com/dwmkerr/openspec-flow/issues/11)) ([71e5652](https://github.com/dwmkerr/openspec-flow/commit/71e56529d110e605b1f5a3ecce571c2e1e2008b5))
* wire create impl handler ([#24](https://github.com/dwmkerr/openspec-flow/issues/24)) ([4ff6f6d](https://github.com/dwmkerr/openspec-flow/commit/4ff6f6d8d934eba4b4bf7eefc0c772217c9bdca9))
* wire intent recognition with classifier + tests + CI ([#6](https://github.com/dwmkerr/openspec-flow/issues/6)) ([1af9b41](https://github.com/dwmkerr/openspec-flow/commit/1af9b41f5e0d4be663deae602942306716e8226d))
* wire iterate-spec handler ([#34](https://github.com/dwmkerr/openspec-flow/issues/34)) ([cd8fedb](https://github.com/dwmkerr/openspec-flow/commit/cd8fedbf0196b72b7abcd8ac6b3332731c3f378b))
* wire real create-spec handler with agent/bot split ([#12](https://github.com/dwmkerr/openspec-flow/issues/12)) ([c29b980](https://github.com/dwmkerr/openspec-flow/commit/c29b980f5e88785f02357a4759e22affeb378ec4))


### Bug Fixes

* badge H1 anchor ignores fenced code blocks ([#72](https://github.com/dwmkerr/openspec-flow/issues/72)) ([718a00e](https://github.com/dwmkerr/openspec-flow/commit/718a00e2d061bd4decc88641f5e151dfd8d69042))
* bake broker_audience into shim so dev/prod brokers each get their own aud ([#85](https://github.com/dwmkerr/openspec-flow/issues/85)) ([c3ee8f4](https://github.com/dwmkerr/openspec-flow/commit/c3ee8f4945b67d2e1f65139723e0eaa6d6085c9a))
* constrain working-status GIF width ([#66](https://github.com/dwmkerr/openspec-flow/issues/66)) ([a7bf369](https://github.com/dwmkerr/openspec-flow/commit/a7bf36957e49cdb7560d5fbc0dc4922ddbb81b40))
* **create-spec:** thread expectedChangeName into prompt + picker ([#90](https://github.com/dwmkerr/openspec-flow/issues/90)) ([3655e2d](https://github.com/dwmkerr/openspec-flow/commit/3655e2dbd6b71dd779876f674d1966ba561c5bd4))
* **deps:** patch transitive vulnerabilities (esbuild, hono, js-yaml, @babel/core) ([#100](https://github.com/dwmkerr/openspec-flow/issues/100)) ([fd9f700](https://github.com/dwmkerr/openspec-flow/commit/fd9f7006060dfeeeae741dab274a623703f856c5))
* install openspec CLI on the Action runner (shim mode) ([#65](https://github.com/dwmkerr/openspec-flow/issues/65)) ([bfb374c](https://github.com/dwmkerr/openspec-flow/commit/bfb374c207f4e602e01e541422ad220e48642ee2))
* reusable workflow's flow job needs id-token: write ([#84](https://github.com/dwmkerr/openspec-flow/issues/84)) ([3c253a7](https://github.com/dwmkerr/openspec-flow/commit/3c253a72c298a3b1745bfee43a591637e4f3aaa6))
* rip per-target sticky-status + status-bodies; handlers mutate lifecycle sticky directly ([#91](https://github.com/dwmkerr/openspec-flow/issues/91)) ([2c2b114](https://github.com/dwmkerr/openspec-flow/commit/2c2b1149974f36d700d3e0102eef04720c197b2a))
* spec PR body uses Refs, not Closes, so issue stays open ([#40](https://github.com/dwmkerr/openspec-flow/issues/40)) ([7c3af9c](https://github.com/dwmkerr/openspec-flow/commit/7c3af9ccb9fc65ad8ff8592eb4e9ce2e07f7f84b))
* sticky transitions to 'creating in workflow #N' on handler start ([#89](https://github.com/dwmkerr/openspec-flow/issues/89)) ([64252ea](https://github.com/dwmkerr/openspec-flow/commit/64252eaf9c205e19b7571b5bf5e695b3bc4b5f6e))


### Documentation

* CLAUDE.md — sync install modes + add CLI surface + build gotchas ([#71](https://github.com/dwmkerr/openspec-flow/issues/71)) ([de95367](https://github.com/dwmkerr/openspec-flow/commit/de95367adca5bb5958ab0cd4a3ebde756b42cdd2))
* **readme:** apply quick-start refinements lost in [#92](https://github.com/dwmkerr/openspec-flow/issues/92) squash race ([#93](https://github.com/dwmkerr/openspec-flow/issues/93)) ([801dab7](https://github.com/dwmkerr/openspec-flow/commit/801dab74ef68ce4ff4f0f073bdb5a84721a299ab))
* **readme:** Quickstart one word; Install before How it works; trade-off inline ([#94](https://github.com/dwmkerr/openspec-flow/issues/94)) ([a1cf515](https://github.com/dwmkerr/openspec-flow/commit/a1cf51527574a263185f5457cb409a34824fefdd))
* rewrite README around the 4-step flow + add docs/how-it-works.md with screenshots ([#92](https://github.com/dwmkerr/openspec-flow/issues/92)) ([687a378](https://github.com/dwmkerr/openspec-flow/commit/687a378f5a79bc7b04cb15a77f23daba1a1e3fa7))


### Chores

* seed first release at 0.1.0 ([#97](https://github.com/dwmkerr/openspec-flow/issues/97)) ([32f5e41](https://github.com/dwmkerr/openspec-flow/commit/32f5e4140be7697346620d6a601dd89d26540f46))
