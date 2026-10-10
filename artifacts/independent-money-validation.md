# Exposed parent case 11: deterministic money regression

The parent supplied this fictional scenario before these tests were written. It is application regression verification and is excluded from unseen model accuracy measurements. The original seller strings and complete buyer wording are preserved in `tests/fixtures/independent-riverlight-money.mjs`; the service test maps only the budget condition to a separate requirement. Its model placeholder remains `unknown`.

Trusted fixture cents yield:

| Version | Item | Delivery | Additional charges | Total | Maximum | Deterministic result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 3400 | 400 | 0 | 3800 | 4000 | match |
| 2 | 3900 | 400 | 0 | 4300 | 4000 | contradiction |

Checkout amounts use the persistent server-owned total. There is no seller-text price parsing or LLM arithmetic. Missing charges, text values, fractional cents, negative cents, extra fields and unsafe integer totals are rejected by the test-only calculator.

`node --test tests/independent-money.test.mjs tests/payments.test.mjs` passed 32/32 tests on 2026-10-10 UTC. Four are the added scenario tests; 28 are existing payment tests. All provider responses are explicitly test-only mocks; no model, network or real PayPal action was performed.

The persistent scenario verifies old $38 review/order snapshots survive restart, the edited $43/version 2 listing makes the old review and approval stale, stale capture is blocked, and fresh checkout requires buyer review confirmation plus approval of a distinct mock provider order. Before the new approval, capture makes no payment request. After separate mock approval, one verified mock capture records $43; the old order remains stale with no capture.

An independent read-only code review found no defects. The original six-item catalogue and production modules are unchanged. Actual sandbox checkout remains a separate uncompleted readiness gate.
