/** Explicit local evaluation. Historical versions remain reproducible from archival source. */
const args = process.argv.slice(2);
const version = args.includes('--evidence-version') ? args[args.indexOf('--evidence-version') + 1] : 'v4';
if (!['v1', 'v2', 'v3', 'v4'].includes(version)) throw new Error('Evidence version must be v1, v2, v3 or v4.');
await import(['v3', 'v4'].includes(version) ? './check-model-v3.mjs' : './check-model-legacy.mjs');
