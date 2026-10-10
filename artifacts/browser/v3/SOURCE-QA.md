# Quote-first source QA

2026-10-10 UTC. Source/browser QA concerns rendered behavior and saved state. It does not grade model selection relevance or confirm seller truth. Separate frozen model evaluation is owned by the evidence agent.

## Inspected surfaces

- public/app.js retains native labels/forms, skip focus, requirement draft guards, explicit checkbox/decision action, current merchant price and reviewed snapshot separation, stale controls and disabled provider actions.
- public/quote-review.js shares the review/receipt renderer: complete immutable snapshot text, neutral integrity labels, exact eligible source-span checks for displayed v3 suggestions, bounded plain-text notices, generic human prompt for no suggestion, optional saved analysis metadata and historical excerpt fallback.
- public/dom.js builds source strings with text nodes; seller markup is not executable HTML. Decorative original SVG art remains outside the model input.
- scripts/browser-check.mjs checks keyboard, repeated clicks, positive draft guard, refresh/history, desktop/mobile overflow, actual stale/new snapshot state and explicit independent buyer confirmation.
- scripts/browser-v3-fixtures.mjs intercepts API routes with conspicuous MOCK branding. Wrong-component/variant selections are deliberately unverified, not graded as relevant. Missing/invalid/unavailable/untrusted/mismatched spans, instruction exclusions, malicious literal markup, historical review/receipt and pending/ambiguous/failed/cancelled capture displays are covered. No completed payment fixture exists.
- scripts/start-browser-qa-server.mjs forces PayPal disabled, captures exact real owned data path, checks containment/equality before native Node removal and responds to stdin end/stop and signals. It never touches the normal .data database.

## Independent review

The integration auditor performed a source-only review without network/model/browser actions or edits and found no blocking helper/mock scope defect. It identified one useful coverage gap: a fresh snapshot could be checked without checking its new analysis digest. The harness now checks SHA-256 binding, unique bounded source-span IDs/offsets/text, eligible suggestion mappings on both initial and fresh snapshots, and changed digest after merchant edit. The strengthened MOCK suite passed all 40 checks again.

The first v3 browser attempt failed on the obsolete harness label `Listing version 1`; the redesigned UI correctly says `Saved version 1`. The assertion was updated and the attempt/screenshots remain preserved. No product fix was needed for this failure.

## Limits

Selected rendered screenshots and meaningful native keyboard actions supplement source review. This is not a formal accessibility certification or a cross-browser suite. Chromium desktop 1280x900 and mobile 390x844 are exercised. Mock captures validate only UI rendering/state transitions, never actual model/provider behavior. The separate natural flow passed 24/24 against frozen v3 and actual local Qwen. It checks source integrity display and saved state, not model selection quality. Owned Qwen unload and exact temporary server-data cleanup are verified in v3 records; parent services/normal data were untouched. Real PayPal sandbox remains unconfigured and unverified.
