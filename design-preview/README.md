# 풍현 디자인 v1.1 · 가상자료 전용 미리보기

Draft preview only. Do not merge this branch into main or promote the deployment to production.

## Scope

This smaller preview contains only presentation tokens/styles, reusable Button/Field/Feedback components, new presentation-only sample layouts, and explicit fictional constants. It contains no cashflow or payment-date calculation, operating schedules, business workflow, auth, application routing, database SDK, API endpoint, original document, real customer record or real company contact field. The email is preview@example.com; displayed phones are 000-0000-0000.

The 267-token v1.1.0-rc.1 source remains unchanged, SHA-256 566f0358059da1e1a3269247652e17d83e18e2eac9528c78260290d364eb594c. `source-manifest.json` identifies seven byte-identical presentation files from design revision 9f18fa6ffc12f1b7c8e1ee03e501f0f21a99d283. The sample table, chart and shell consume these actual styles; they are not the full production application's table, chart or workflow implementation.

The dialog demonstrates the same native-dialog presentation pattern with all operating services and routes removed. Links are page fragments or this static preview's query parameters. Chart amounts and heights are explicitly declared fictional constants; formatting a number does not run a financial calculation. The specimen PDF was generated only for this preview.

## Build and safety

- `npx tsc -p design-preview/tsconfig.json`
- `node design-preview/build.mjs`
- Inspect `design-preview/build-audit.json`

The build validates source hashes, whitelists the six pure UI modules, rejects backend/business/contact signatures, and emits static files only. A VERCEL_ENV=production build is rejected before output mutation. This is a build guard, not protection against every possible manual deployment reassignment.

The branch-local vercel.json uses `framework: null`, the custom build command and `design-preview-dist`. No global Vercel security setting, existing deployment protection, main branch, production app or write-pause flag is changed. Indexing is disabled. The existing font CDN makes ordinary asset requests; no entered field values are transmitted or stored.

## Review boundary

Desktop and 390px/768px iframe viewports can inspect real CSS breakpoints, keyboard states, native dialog and hypothetical feedback. An iframe viewport is not a physical phone. Calculations, business workflows, auth, storage and real customer operations are not preview verification targets.
