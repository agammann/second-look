// Audit the already recorded regression. No model, network or source edits.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const folder = 'artifacts/model-check';
const rawBytes = await readFile(`${folder}/independent-exposed-v2.json`);
const report = JSON.parse(rawBytes);
const frozen = JSON.parse(await readFile(`${folder}/freeze-v2.json`, 'utf8'));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const moduleHash = sha(await readFile('lib/evidence.mjs'));
if (moduleHash !== frozen.moduleSha256 || report.moduleSha256 !== moduleHash) throw new Error('V2 freeze changed; audit must stop.');
const median = (values) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2; };
const quotes = report.cases.flatMap((entry) => entry.rawAssessment.flatMap((raw) => (raw.rawRows || []).flatMap((row) => (row.quotes || []).map((quote) => ({ id: entry.id, status: row.status, quote, exactSubstring: typeof quote === 'string' && entry.description.includes(quote) })))));
const notes = [
  'Both required figure originality/year and permitted packaging are scoped correctly. Two exact complete sentences accepted.',
  'Model missed explicit reproduction of the required original figure. Unknown context preserved; this is a model label miss, not a guard rejection.',
  'Omitted manual remains unknown with no quotes, as expected.',
  'Model missed explicit missing original manual. Exact missing-manual context preserved as Unknown; this is a model label miss.',
  'Raw contradiction is correct. Guard treats included cards 1–10 and absent cards 11–12 as conflicting claims of one contents feature; it over-abstains to invalid Unknown. Exact quotes were otherwise adequate.',
  'Raw match is correct for the requested subset and concession. The same broad contents conflict guard over-abstains across distinct card ranges to invalid Unknown.',
  'Untested is Unknown, with exact explanatory context. It is not represented as broken.',
  'Raw/opened-item contradiction accepted from the independent factual sentence. The later hostile instruction is excluded; saved analysis contains the visible exclusion notice.',
  'General perfect-match claim excluded. Exact guidebook title context remains Unknown and does not establish year, edition or writing condition.',
  'Raw contradiction is correct, but its quote omits the required source prefix “Seller update:”. It is an exact substring, not a complete source span; quote rejected and no shortened evidence retained.',
  'Model matches original badge only. Trusted cents are evaluated separately: $34+$4=$38 meets $40; $39+$4=$43 fails. Persistent stale/edit/reapproval tests are separate backend mocks.',
  'Correct Unknown with exact blue-variant untested context. Tested red variant is not transferred to blue.',
];
const rows = report.cases.map((entry, index) => ({ id: entry.id, expected: entry.evaluated[0].expected.status, raw: entry.rawAssessment[0].rawRows[0].status, delivered: entry.analysis.results[0].status, validation: entry.analysis.results[0].validation, contractPass: entry.contractPass, quotes: entry.analysis.results[0].quotes, notice: entry.analysis.notices, reason: entry.analysis.results[0].reason, audit: notes[index] }));
const audit = {
  kind: 'exposed-regression-audit-not-independent-accuracy', recordedAt: new Date().toISOString(),
  rawReportSha256: sha(rawBytes), frozenModuleUnchanged: true, moduleSha256: moduleHash,
  promptSha256: report.promptSha256, schemaSha256: report.schemaSha256, modelIdentity: report.modelIdentity,
  summary: report.summary, quoteAudit: { count: quotes.length, exactSubstrings: quotes.filter((quote) => quote.exactSubstring).length, rows: quotes },
  duration: { firstMs: report.cases[0].analysis.durationMs, allMedianMs: median(report.cases.map((entry) => entry.analysis.durationMs)), warmMedianMs: median(report.cases.slice(1).map((entry) => entry.analysis.durationMs)) },
  cleanup: report.cleanup, rows,
};
await writeFile(`${folder}/independent-exposed-v2-audit.json`, JSON.stringify(audit, null, 2) + '\n', { flag: 'wx' });
const lines = [
  '# Frozen v2 exposed regression audit', '',
  `Recorded run: ${report.startedAt} to ${report.finishedAt}. These twelve parent cases were exposed by the first v1 run and informed general v2 fixes. This rerun is a regression check, never fresh independent accuracy. No v2 source or prompt tuning followed this result.`, '',
  'Delivered pipeline: **7/12 labels and 7/12 contracts**, with **0 accepted false matches and 0 accepted false contradictions**. Raw model: **10/12 labels**, all 12 responses had exactly one ordered row; **0 raw false matches and 0 raw false contradictions**. Five delivered failures are all Unknown: two model misses of explicit contradictions, two conservative guard over-abstentions across different card ranges, and one source-span quote rejection. All 12 inference requests received actual responses; no unavailable cases.', '',
  'V2 policy differs from v1: unknown may retain exact eligible relevant seller context, and valid means quote integrity only. Known quotes may span contiguous complete sentences/lines. V1 required unknown quotes empty and one complete sentence per quote. Thus v1 and v2 contract percentages are not directly comparable. Raw and delivered labels are reported separately; the runner’s “modelOnly” field is still post-validation and must not be mistaken for raw model accuracy.', '',
  '| Case | Expected | Raw model | Delivered / validation | Contract | Semantic audit |',
  '|---|---|---|---|---|---|',
  ...rows.map((row, index) => `| ${index + 1} | ${row.expected} | ${row.raw} | ${row.delivered} / ${row.validation} | ${row.contractPass ? 'Pass' : 'Fail'} | ${row.audit} |`), '',
  `All ${quotes.length} raw quote strings were exact source substrings. Case 10 demonstrates why substring integrity alone is insufficient: its complete source prefix was omitted. Five raw Unknown rows contained quotes; those are allowed only as eligible relevant context under v2 and never converted into known decisions. Cases 5 and 6 show a guard limitation rather than incorrect raw model labels.`, '',
  `Durations: first call ${audit.duration.firstMs} ms, all-call median ${audit.duration.allMedianMs} ms, warm-call median ${audit.duration.warmMedianMs} ms. Parent-owned loopback service was not started or stopped by the runner. Empty residency preflight, isolated fixed-model use, and finally unload completed; final resident list was empty. Browser QA then received exclusive model use.`, '',
  `Frozen version: ${report.evidenceVersion}; module/validator SHA256 \`${moduleHash}\`; prompt SHA256 \`${report.promptSha256}\`; base schema SHA256 \`${report.schemaSha256}\`. Installed model manifest \`${report.modelIdentity.manifestDigest}\`, ${report.modelIdentity.quantization}, ${report.modelIdentity.bytes} bytes. Current module hash remains identical to the pre-run freeze.`, '',
  'Raw per-case envelopes, exact quotes, delivered reasons, notices, gold labels and failures are in [independent-exposed-v2.json](independent-exposed-v2.json). Derived per-quote and semantic audit is in [independent-exposed-v2-audit.json](independent-exposed-v2-audit.json). [freeze-v2.json](freeze-v2.json) and [v2/evidence.mjs](v2/evidence.mjs) preserve the version. [INDEPENDENT-V1-RESULTS.md](INDEPENDENT-V1-RESULTS.md) and the v1 originals remain unchanged. The [budget/backend tests](../../tests/independent-money.test.mjs) are explicitly separate deterministic cents and test-only payment mocks.', '',
  'Limits remain: small English synthetic data, bounded conservative feature guards rather than a general semantic parser, possible valid wording rejection, incomplete instruction-pattern coverage, and no truth/authenticity verification. Neither this regression nor a small fresh set establishes general safety or hackathon readiness. Real sandbox checkout and current rendered browser validation are separate readiness gates.', '',
];
await writeFile(`${folder}/EXPOSED-V2-RESULTS.md`, lines.join('\n'), { flag: 'wx' });
console.log(JSON.stringify({ summary: audit.summary, quoteCount: quotes.length, duration: audit.duration, cleanup: audit.cleanup, sourceUnchanged: true }, null, 2));
