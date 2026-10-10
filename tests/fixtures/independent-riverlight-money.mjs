/** TEST-ONLY fictional money scenario from parent independent holdout case 11.
 * The parent exposed this case before these regression tests were written.
 * This is deterministic application verification, never an unseen model score.
 * These trusted cents come from the authorized fixture, not seller-text parsing,
 * browser values, a model answer, or a real merchant/payment record.
 */
export const provenance = Object.freeze({
  source: 'parent-independent-holdout-case-11',
  exposedBeforeTestAuthoring: true,
  synthetic: true,
  testOnly: true,
  modelAccuracyMeasurement: false,
});

export function totalFixtureCents(breakdown) {
  const keys = ['itemCents', 'deliveryCents', 'additionalChargesCents'];
  if (!breakdown || typeof breakdown !== 'object' || Array.isArray(breakdown)
    || Object.keys(breakdown).length !== keys.length
    || keys.some((key) => !Number.isSafeInteger(breakdown[key]) || breakdown[key] < 0)
    || Object.keys(breakdown).some((key) => !keys.includes(key))) {
    throw new TypeError('The trusted test fixture must supply every charge explicitly in nonnegative integer cents.');
  }
  const total = keys.reduce((sum, key) => sum + breakdown[key], 0);
  if (!Number.isSafeInteger(total)) throw new RangeError('The fixture total exceeds safe integer cents.');
  return total;
}

export function fixtureBudgetVerdict(totalCents, maximumCents) {
  if (![totalCents, maximumCents].every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new TypeError('Fixture totals and budget must be nonnegative integer cents.');
  }
  return totalCents <= maximumCents ? 'match' : 'contradiction';
}

const originalMoney = Object.freeze({ itemCents: 3400, deliveryCents: 400, additionalChargesCents: 0 });
const updatedMoney = Object.freeze({ itemCents: 3900, deliveryCents: 400, additionalChargesCents: 0 });
const listingBase = Object.freeze({
  id: 'test-only-riverlight-badge', title: 'Riverlight badge',
  subtitle: 'Fictional exposed scenario — tests only', currency: 'USD', art: 'tide',
});

export const riverlightMoneyScenario = Object.freeze({
  provenance,
  buyerOriginal: 'An original Riverlight badge for no more than $40 total, including delivery.',
  requirement: 'Maximum $40 including delivery and all charges',
  requirementMapping: Object.freeze({ source: 'buyerOriginal', scope: 'isolated budget condition',
    originalEditionClaim: 'Preserved in buyerOriginal; requires a separate seller-evidence review.' }),
  maximumCents: 4000,
  originalMoney,
  updatedMoney,
  original: Object.freeze({ ...listingBase, version: 1,
    description: 'Original Riverlight badge. Item $34; delivery $4; no additional charges.',
    priceCents: totalFixtureCents(originalMoney),
  }),
  updated: Object.freeze({ ...listingBase, version: 2,
    description: 'Original Riverlight badge. Item $39; delivery $4; no additional charges.',
    priceCents: totalFixtureCents(updatedMoney),
  }),
});
