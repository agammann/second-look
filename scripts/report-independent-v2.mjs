// Audit the first frozen v2 fresh run only. No model/network request or implementation edit.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const folder = 'artifacts/model-check';
const rawBytes = await readFile(`${folder}/independent-holdout-v2.json`);
const report = JSON.parse(rawBytes);
const fixtureBytes = await readFile('tests/fixtures/independent-holdout-v2.json');
const fixture = JSON.parse(fixtureBytes);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const frozen = JSON.parse(await readFile(`${folder}/freeze-v2.json`, 'utf8'));
const moduleHash = sha(await readFile('lib/evidence.mjs'));
if (moduleHash !== frozen.moduleSha256 || report.moduleSha256 !== moduleHash || sha(await readFile(`${folder}/v2/evidence.mjs`)) !== moduleHash) throw new Error('Frozen source changed.');
const notes = [
  'Raw contradiction and complete map-lost quote are correct. The bounded feature guard recognizes printing but not map/lost scope, and withholds the correct known decision. This is a validator false abstention, not malformed model output.',
  'Raw match and replica quote support the supplied expectation. Narrow lexical relevance does not connect reproduction with replica, so the correct model decision is withheld. Expensive has no numeric threshold; the supplied Match is retained without any price calculation or pricing advice.',
  'Raw and delivered Unknown are correct. The exact context says hands move but timekeeping accuracy was not checked; the model did not conflate movement with keeping time.',
  'Model returns Unknown despite the explicit clean interior pages. The cover name does not concern page markings. Delivered Unknown is unchanged; this is a model label miss.',
  'Model returns Unknown instead of the supplied contradiction. Displayed original charger is comparison-only, while generic charger ships. Exact generic-charger context remains Unknown. This is a model scope/inclusion miss; no photograph was inspected.',
  'Raw match is correct: all eight figures are included and originality was not requested. The narrow feature guard does not recognize the plural figures/set/count scope and rejects the known decision. This is a validator false abstention.',
  'Raw and delivered contradiction quote only the opened shipping carton. Supplied expectation is Match based on the sealed retail package; scored as a false contradiction with no expectation rewrite. Buyer package wording is ambiguous between shipping carton and retail package; that ambiguity is documented separately, not used to relax the score.',
  'Raw Unknown is correct. Exact unidentified-name context is useful for the creator-signature question, but lexical relevance does not bridge name and signature and discards it as invalid. Delivered label remains correct while the context/validation contract fails. This is a context guard limitation.',
];
const median = (values) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2; };
const rows = report.cases.map((entry, index) => {
  const parent = fixture.parentProvided[index];
  const inputExact = entry.description === parent.listing && entry.requirements.length === 1 && entry.requirements[0] === parent.buyer && entry.evaluated[0].expected.status === parent.expected;
  const raw = entry.rawAssessment[0].rawRows[0];
  return { id: entry.id, buyer: parent.buyer, listing: parent.listing, expected: parent.expected, inputExact, raw, delivered: entry.analysis.results[0], labelCorrect: entry.evaluated[0].labelCorrect, contractPass: entry.contractPass, durationMs: entry.analysis.durationMs, audit: notes[index] };
});
if (!rows.every((row) => row.inputExact)) throw new Error('Input or expectation changed.');
const quoteRows = rows.flatMap((row) => row.raw.quotes.map((quote) => ({ id: row.id, quote, exactSubstring: row.listing.includes(quote) })));
const preservationChecks = [
  ['v1 source', `${folder}/v1/evidence.mjs`, 'b004c705e47eacc9bbcd62278ba0dfcad7169b482329d203854ffee5d9af051a'],
  ['v1 original first fixture', 'tests/fixtures/independent-holdout-v1.json', 'e7bc604f21cbfc5ee3c87beef52ca30de0fa8c18a49e225b8bdf1a360512d518'],
  ['v1 preserved first fixture', `${folder}/v1/independent-first-fixture.json`, 'e7bc604f21cbfc5ee3c87beef52ca30de0fa8c18a49e225b8bdf1a360512d518'],
  ['v1 original first raw report', `${folder}/independent-holdout-v1.json`, '0960a6f8ecdfd224651784f116a766a09c981a8b179dfe343c4ed5a6e945681b'],
  ['v1 preserved first raw report', `${folder}/v1/independent-first-report.json`, '0960a6f8ecdfd224651784f116a766a09c981a8b179dfe343c4ed5a6e945681b'],
];
const preserved = [];
for (const [name, path, expectedSha256] of preservationChecks) {
  const actualSha256 = sha(await readFile(path));
  if (actualSha256 !== expectedSha256) throw new Error(`Preserved ${name} changed.`);
  preserved.push({ name, path, expectedSha256, actualSha256, unchanged: true });
}
const audit = {
  kind: 'first-frozen-v2-independent-holdout-audit', recordedAt: new Date().toISOString(),
  sourceFreezePredatesCaseExposure: true, firstAndOnlyRun: true, inputsAndExpectationsExact: true,
  datasetNowExposed: true, futureTunedRerunsMustBeRegression: true, noTuningOrSourceChangesAfterResult: true,
  reportSha256: sha(rawBytes), datasetSha256: sha(fixtureBytes), moduleSha256: moduleHash, validatorSha256: moduleHash, promptSha256: report.promptSha256, schemaSha256: report.schemaSha256,
  modelIdentity: report.modelIdentity, summary: report.summary,
  quoteAudit: { count: quoteRows.length, exactSubstrings: quoteRows.filter((row) => row.exactSubstring).length, rows: quoteRows },
  duration: { firstMs: rows[0].durationMs, allMedianMs: median(rows.map((row) => row.durationMs)), warmMedianMs: median(rows.slice(1).map((row) => row.durationMs)) },
  case7Ambiguity: 'Unopened package may refer to shipping carton or retail package. Supplied Match is retained and the accepted carton-only Contradiction is counted as false contradiction; ambiguity does not relax the score.',
  cleanup: report.cleanup, preservedV1: preserved, rows,
};
await writeFile(`${folder}/independent-holdout-v2-audit.json`, JSON.stringify(audit, null, 2) + '\n', { flag: 'wx' });
const lines = [
  '# First frozen v2 independent holdout audit', '',
  `V2 was frozen at ${frozen.frozenAt}. The parent's exact eight cases arrived afterward, were transcribed at ${fixture.frozenAt}, and were run once from ${report.startedAt} to ${report.finishedAt}. Each full buyer statement was one requirement; no normalization, truncation, attribute extraction or expectation rewriting occurred. Gold quote criteria were recorded before inference and never sent to the model. Code and prompt remained frozen; no tuning or further model request followed this result. These cases are now exposed; any later tuned rerun is a regression.`, '',
  '**Delivered pipeline: 2/8 labels and 1/8 contracts. Raw model: 5/8 labels. Zero raw or delivered false matches; one raw and delivered false contradiction (case 7).** All eight requests received real completed model responses with one ordered row. The low delivered score shows substantial semantic/relevance guard limitations; it does not establish reliable generalization or hackathon readiness. The runner’s “modelOnly” field is post-validation, while “rawModel” records pre-guard labels.', '',
  '| Case | Supplied expected | Raw model | Delivered / validation | Contract | Failure or semantic audit |',
  '|---|---|---|---|---|---|',
  ...rows.map((row, index) => `| ${index + 1} | ${row.expected} | ${row.raw.status} | ${row.delivered.status} / ${row.delivered.validation} | ${row.contractPass ? 'Pass' : 'Fail'} | ${row.audit} |`), '',
  'Cases 1, 2 and 6 demonstrate rejection of correct known model labels by narrow deterministic scope/relevance checks. Case 8 demonstrates rejection of useful exact unknown context while retaining the correct Unknown label. Cases 4 and 5 are raw model misses of the supplied known labels. Case 7 is an accepted scope error relative to the supplied expectation, even though the buyer word package is ambiguous; the expected Match and failure count are unchanged. Case 3 correctly distinguishes movement from unchecked timekeeping.', '',
  `All ${quoteRows.length}/${quoteRows.length} raw quote strings are exact complete source sentences; there are no altered or shortened quote failures in this run. Three raw Unknown rows have context quotes. V2 allows exact eligible relevant Unknown context, but narrow lexical relevance incorrectly discards the signature/name context in case 8. Valid context is not a supported known decision or proof of truth.`, '',
  'The v2 contract permits exact eligible relevant context for Unknown and bounded contiguous complete source spans for known decisions. V1 required empty Unknown arrays and one complete sentence per quote. Contract percentages across v1/v2 are therefore not directly comparable. The exposed twelve-case v2 rerun is separately labeled regression; it is not independent evidence for this new set.', '',
  `First-call duration ${audit.duration.firstMs} ms; all-call median ${audit.duration.allMedianMs} ms; warm-call median ${audit.duration.warmMedianMs} ms. No service startup/stop, tunnel, binding, firewall or sandbox change was made by the runner. Empty residency preflight and isolated owned-model use allowed finally cleanup; final /api/ps resident list was empty and unloaded=true. The root retains responsibility for stopping its own Ollama service.`, '',
  `Frozen module/validator SHA256: \`${moduleHash}\`. Prompt SHA256: \`${report.promptSha256}\`. Base schema SHA256: \`${report.schemaSha256}\`; per-count request schema hashes are in [freeze-v2.json](freeze-v2.json). Dataset SHA256: \`${audit.datasetSha256}\`. Raw report SHA256: \`${audit.reportSha256}\`. Installed retained model manifest: \`${report.modelIdentity.manifestDigest}\`; ${report.modelIdentity.quantization}, ${report.modelIdentity.bytes} bytes, ${report.modelIdentity.family}/${report.modelIdentity.parameterSize}. Metadata was read from existing loopback tags/show before inference; no secrets or accounts were accessed.`, '',
  'Exact inputs and predeclared gold criteria: [independent-holdout-v2.json](../../tests/fixtures/independent-holdout-v2.json) and [input provenance](independent-holdout-v2-input-provenance.json). Full raw envelopes, per-requirement output, validator reasons and failures: [independent-holdout-v2.json](independent-holdout-v2.json). Derived quote/semantic audit, unchanged v1 byte hashes and current freeze verification: [independent-holdout-v2-audit.json](independent-holdout-v2-audit.json). The original v1 module, exact first fixture and first raw report remain byte-identical to their recorded hashes.', '',
  'This small synthetic set cannot establish real seller reliability, broad instruction detection, truth, provenance, authenticity or payment readiness. Remaining limits include unsupported feature vocabulary, weak synonym and subject binding, over-abstention on correctly supported known claims, useful unknown-context rejection, and the accepted packaging-scope contradiction. Further semantic-classifier growth was deliberately stopped at the frozen coherent prototype; these failures remain visible for review.', '',
];
await writeFile(`${folder}/INDEPENDENT-V2-RESULTS.md`, lines.join('\n'), { flag: 'wx' });
console.log(JSON.stringify({ summary: audit.summary, quoteAudit: { count: quoteRows.length, exact: audit.quoteAudit.exactSubstrings }, duration: audit.duration, cleanup: audit.cleanup, currentFreezeUnchanged: true, allV1BytesUnchanged: true, datasetNowExposed: true }, null, 2));
