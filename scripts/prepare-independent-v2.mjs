// Transcribe parent input after v2 freeze. No network/model request or implementation edit.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const provided = [
  {buyer:"I want the 2001 first printing, with the map included.",listing:"North Pier adventure book. First printing, 2001. The fold-out map was lost.",expected:"contradiction"},
  {buyer:"I want a reproduction, not an expensive original.",listing:"Newly manufactured replica of the 1970 Signal Bell badge. No vintage item is included.",expected:"match"},
  {buyer:"The clock must keep time.",listing:"Cloudwatch desk clock. The hands move when wound; timekeeping accuracy has not been checked.",expected:"unknown"},
  {buyer:"No markings on the pages.",listing:"The cover has an owner's name. All interior pages are clean, without writing or highlighting.",expected:"match"},
  {buyer:"The original charger needs to be included.",listing:"Pocket Beacon toy. The original charger is shown in the last photo for comparison only. A generic charger ships with the toy.",expected:"contradiction"},
  {buyer:"The set needs all eight figures.",listing:"Eight-figure Cedar Crew set. Seven figures are original; the eighth is a modern replacement. All eight are included.",expected:"match"},
  {buyer:"I need an unopened package.",listing:"The shipping carton was opened for photography. The manufacturer's retail package remains factory sealed and unopened.",expected:"match"},
  {buyer:"The piece must be signed by its creator.",listing:"A name appears on the underside. The seller cannot identify whose name it is.",expected:"unknown"},
];
const gold = [
  { quotes: ['The fold-out map was lost.', 'First printing, 2001. The fold-out map was lost.'], criteria: 'The missing map contradicts its required inclusion. Year/printing are explicitly stated; they do not resolve the missing map.' },
  { quotes: ['Newly manufactured replica of the 1970 Signal Bell badge.', 'Newly manufactured replica of the 1970 Signal Bell badge. No vintage item is included.'], criteria: 'Newly manufactured replica supports reproduction; an original is explicitly not included. Expensive is a buyer preference without a monetary limit, not a model price calculation or pricing advice.' },
  { quotes: [], criteria: 'Moving hands do not establish timekeeping accuracy. Not checked is useful unknown context, never broken. V2 may preserve exact eligible relevant context.' },
  { quotes: ['All interior pages are clean, without writing or highlighting.', "The cover has an owner's name. All interior pages are clean, without writing or highlighting."], criteria: 'Buyer asks about pages, not the cover. Known support must include the whole interior-pages sentence; cover-only text is inadequate.' },
  { quotes: ['The original charger is shown in the last photo for comparison only.', 'A generic charger ships with the toy.', 'The original charger is shown in the last photo for comparison only. A generic charger ships with the toy.'], criteria: 'Comparison-only original charger and shipped generic charger explicitly distinguish displayed vs supplied charger. Audit the quote set for this relationship; no image is inspected or used as evidence.' },
  { quotes: ['All eight are included.', 'Eight-figure Cedar Crew set. Seven figures are original; the eighth is a modern replacement. All eight are included.'], criteria: 'All eight figures are required, with no originality requirement. One replacement does not contradict inclusion. The quantity sentence must be interpreted with the set identity; replacement-only text is inadequate.' },
  { quotes: ["The manufacturer's retail package remains factory sealed and unopened.", "The shipping carton was opened for photography. The manufacturer's retail package remains factory sealed and unopened."], criteria: 'Unopened concerns the retail package; shipping-carton opening does not change retail-package condition. Support must include the retail-package sentence. Preserve any ambiguity in buyer package terminology explicitly.' },
  { quotes: [], criteria: 'An unidentified name does not establish creator signature. V2 may preserve exact eligible relevant context; it remains Unknown.' },
];
const sha = (value) => createHash('sha256').update(value).digest('hex');
const freeze = JSON.parse(await readFile('artifacts/model-check/freeze-v2.json', 'utf8'));
if (sha(await readFile('lib/evidence.mjs')) !== freeze.moduleSha256) throw new Error('Current module differs from v2 freeze.');
const now = new Date().toISOString();
const dataset = {
  dataset: 'parent-independent-holdout-v2', purpose: 'fresh-holdout', frozenAt: now,
  inputProvenance: 'Exact eight parent buyer/listing/expected strings received only after v2 implementation/prompt freeze. Each full buyer statement is one requirement; no text normalization, truncation or attribute mapping. Gold quote criteria declared before the first and only model run. Expectations and gold quotes are not sent to the model.',
  implementationFreeze: freeze, parentProvided: provided,
  cases: provided.map((entry, index) => ({ id: `fresh-v2-${String(index + 1).padStart(2, '0')}`, buyer: entry.buyer, listing: entry.listing, expectedLabel: entry.expected, description: entry.listing, requirements: [entry.buyer], expected: [{ status: entry.expected, acceptableQuotes: gold[index].quotes, note: gold[index].criteria }] })),
};
for (const [index, entry] of dataset.cases.entries()) {
  if (entry.description !== provided[index].listing || entry.requirements[0] !== provided[index].buyer || entry.expected[0].status !== provided[index].expected) throw new Error('Input mapping changed.');
  if (entry.expected[0].acceptableQuotes.some((quote) => !entry.description.includes(quote))) throw new Error('Gold quote is not exact source text.');
}
const bytes = JSON.stringify(dataset, null, 2) + '\n';
await writeFile('tests/fixtures/independent-holdout-v2.json', bytes, { flag: 'wx' });
await writeFile('artifacts/model-check/independent-holdout-v2-input-provenance.json', JSON.stringify({ recordedAt: now, source: 'Parent exact eight-case JSON message', cases: provided, mapping: 'Each full buyer statement is the sole requirement, verbatim.', allExact: true, datasetSha256: sha(bytes), implementationFrozenBeforeExposure: true, freeze }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ cases: dataset.cases.length, datasetSha256: sha(bytes), allExact: true, freezeTime: freeze.frozenAt, preparedAt: now }, null, 2));
