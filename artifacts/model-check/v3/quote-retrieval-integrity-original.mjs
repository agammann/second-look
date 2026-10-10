/** Evaluation helpers: source integrity only. No semantic or buying verdict scoring. */
import { createHash } from 'node:crypto';

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/** Preserve every complete requirement and source byte; evaluation criteria never enter model input. */
export function mapRetrievalDataset(value) {
  const rawCases = Array.isArray(value) ? value : value?.cases;
  if (!Array.isArray(rawCases) || !rawCases.length || rawCases.length > 100) throw new Error('Provide 1-100 retrieval cases.');
  return {
    name: Array.isArray(value) ? 'parent-independent-quote-v3' : value.dataset,
    cases: rawCases.map((entry, index) => ({
      id: entry.id ?? `fresh-v3-${String(index + 1).padStart(2, '0')}`,
      description: entry.listing ?? entry.description,
      requirements: entry.requirements,
      criteria: {
        essentialQuotes: entry.essentialQuotes ?? entry.criteria?.essentialQuotes ?? [],
        acceptableQuestion: entry.acceptableQuestion ?? entry.criteria?.acceptableQuestion ?? null,
        acceptableQuestions: entry.acceptableQuestions ?? entry.criteria?.acceptableQuestions ?? [],
        pitfall: entry.pitfall ?? entry.criteria?.pitfall ?? null,
      },
    })),
  };
}

/** Check rendered associations and exactness; irrelevant selections can pass these checks. */
export function assessRenderedIntegrity(analysis, input, catalogue, limits, version) {
  const spanMap = new Map((analysis.sourceSpans ?? []).map((span) => [span.id, span]));
  const questionMap = new Map(catalogue.map((question) => [question.id, question.text]));
  const snapshot = analysis.kind === 'quote-suggestions' && analysis.evidenceVersion === version &&
    analysis.sourceDigest === sha256(input.description) && Array.isArray(analysis.sourceSpans) &&
    analysis.sourceSpans.length <= limits.spans && spanMap.size === analysis.sourceSpans.length &&
    analysis.sourceSpans.every((span, index) => span.id === `s${index + 1}` && Number.isInteger(span.start) && Number.isInteger(span.end) &&
      span.start >= 0 && span.end > span.start && span.end <= input.description.length &&
      typeof span.eligible === 'boolean' && input.description.slice(span.start, span.end) === span.text);
  const count = Array.isArray(analysis.results) && analysis.results.length === input.requirements.length;
  return input.requirements.map((requirement, index) => {
    const row = analysis.results?.[index];
    const checks = {
      snapshotIdentity: snapshot,
      requirementAssociation: count && row?.requirement === requirement,
      noVerdict: row && !['status', 'match', 'contradiction', 'quotes'].some((key) => Object.hasOwn(row, key)),
      sourceRendering: Array.isArray(row?.suggestions) && row.suggestions.length <= limits.suggestions &&
        new Set(row.suggestions.map((item) => item.spanId)).size === row.suggestions.length &&
        row.suggestions.every((item) => spanMap.get(item.spanId)?.eligible === true && item.quote === spanMap.get(item.spanId).text),
      fixedQuestions: Array.isArray(row?.questions) && row.questions.length <= limits.questions &&
        new Set(row.questions.map((item) => item.id)).size === row.questions.length &&
        row.questions.every((item) => questionMap.has(item.id) && questionMap.get(item.id) === item.text) &&
        (row?.suggestions?.length > 0 || !row?.questions?.some((item) => item.id === 'q_scope')),
      failureVisible: ['valid', 'invalid', 'unavailable', 'untrusted'].includes(row?.validation) && typeof row?.reason === 'string' &&
        (row.validation === 'valid' || (row.suggestions?.length === 0 && row.questions?.length === 0)),
    };
    return { index, requirement, checks, renderedIntegrityPass: Object.values(checks).every((check) => check === true),
      validation: row?.validation ?? 'missing', semanticAdequacy: 'not scored by mechanical checks' };
  });
}

export function pendingRetrievalAudit(criteria) {
  return { state: 'pending-human-review', criteria, rubric: 'tests/fixtures/QUOTE-RETRIEVAL-RUBRIC.md',
    dimensions: { aspectCoverage: 'pending', qualificationsAndCorrections: 'pending', componentVariantScope: 'pending',
      relevanceAndEconomy: 'pending', emptySelectionUsefulness: 'pending', questionNeutrality: 'pending', questionUsefulness: 'pending' },
    note: 'Exact source rendering is not semantic coverage, truth, authentication, completeness or approval.' };
}
