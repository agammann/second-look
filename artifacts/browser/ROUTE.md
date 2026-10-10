# Supported local browser route

Updated 2026-10-10 UTC. Local interactive browser QA now passes using existing Playwright 1.62.1 and matching installed Chromium headless shell revision 1234 (151.0.7922.34). Chromium sandboxing stays enabled (`chromiumSandbox: true`); no browser or package was downloaded.

The Browser plugin/skill is absent. The frontend-testing-debugging skill explicitly permits regular Playwright in that case. The computer-use skill was read; its required node_repl tool is not exposed and native CUA APIs are disabled. One CUA getState() probe failed before browser acquisition with MXC HRESULT 0x80070003; it was not retried.

## Initial restricted-context failures

| Route | Result |
| --- | --- |
| CUA getState() | Kernel exits, MXC HRESULT 0x80070003 |
| Playwright/system Chrome 155, sandbox enabled | Exits before page creation; Crashpad named-pipe error 0x6D |
| Playwright/matching headless shell 1234, sandbox enabled | Exits before page creation, exit 2147483651 |
| Minimal direct full Chromium 1234, owned workspace profile | Windows side-by-side configuration error |
| Minimal direct system Chrome, owned workspace profile | No screenshot; only Crashpad profile files |

The original failure is preserved in [route-probe.json](route-probe.json). The parent also observed loopback EACCES in that execution context. Unchanged failed launches were stopped.

The parent then explicitly clarified that narrowly scoped, auto-reviewed exec_command require_escalated approval for authorized local testing was supported. The approved loopback HTTP check passed. Browser runs subsequently passed in that approved execution context. This changed the execution context, not Chromium sandboxing. There was no denied-action bypass, --no-sandbox, public tunnel, firewall change, non-loopback binding, credential access, account action or payment.

## Reproduction and scope

Run the loopback app, then `node scripts/browser-check.mjs`. On this host its narrowly scoped supported execution approval is required. It uses installed Playwright/headless shell to make actual typing, keyboard and click actions. APP_ORIGIN selects an HTTP 127.0.0.1 port; PLAYWRIGHT_MODULE_PATH and CHROME_PATH can select existing compatible installations. `--catalogue-only` captures the current actual catalogue with read-only config/listing GETs and no model/provider calls.

`--merchant-edit` mutates the synthetic listing in the selected database, checks stale controls, and requires a fresh review/explicit confirmation. Use isolated QA data for this option. `scripts/start-browser-qa-server.mjs` starts an isolated server on 127.0.0.1:4322, forces PayPal disabled, and removes only its verified owned temporary directory after stop on stdin.

With that helper running, `node scripts/browser-check.mjs --isolated-qa --merchant-edit` selects port 4322. Natural checks require the current evidence version, a positive live-model duration and no unavailable fallback. EXPECTED_EVIDENCE_VERSION can select a later intentionally frozen evidence version. Do not start concurrent Qwen requests; obtain exclusive model handoff first.

`--mock-ui --merchant-edit` intercepts browser API requests with visibly labeled MOCK fixtures. It makes no model/provider calls and contains no completed payment fixture. These checks validate rendered UI only, not server state or real PayPal integration.

The first live-model run passed 17/17 with zero console errors. The final v2 UI mock run passed 34/34 with zero errors. The frozen-v2 natural run passed 24/24 with zero errors, two actual sequential Qwen reviews, real synthetic merchant edit, stable focus/navigation and new review confirmation. See [QA.md](QA.md). V1 remains preserved under frozen-v1. The owned port 4322 server stopped and its exact temporary data was removed; Qwen was unloaded and verified empty before exclusive handback. Real PayPal sandbox checkout remains untested and disabled.
