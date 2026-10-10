# Original work and external components

The project code, fictional North Quay descriptions and six code-native SVG collectible illustrations were created for this prototype and licensed under MIT in LICENSE. No recognizable licensed character, marketplace listing, photograph, stock asset or external font is distributed. Second Look is a working title without name clearance. PayPal is a third-party name used to identify the sandbox integration; no endorsement is implied.

## Runtime dependencies

There are **zero npm runtime dependencies** and no bundled node_modules, browser binary, Ollama program or model weights in the delivered source/archive.

Node.js 24.19.0 was the tested external runtime; Node.js uses the MIT license and includes separately licensed components. The app uses its built-in `node:http`, `node:sqlite`, `node:crypto`, filesystem, fetch and test APIs. SQLite is part of that runtime. Node distribution notices remain with the user's installed runtime. [Node.js license](https://github.com/nodejs/node/blob/main/LICENSE), [SQLite copyright statement](https://www.sqlite.org/copyright.html).

Ollama 0.35.0 is an external optional local inference runtime, licensed separately under MIT. No copy is redistributed. [Ollama license](https://github.com/ollama/ollama/blob/main/LICENSE).

## Retained local model

Only `qwen3.5:4b-q4_K_M` is supported. The task-3 verification recorded manifest SHA-256 `d8b0f5e9760cd1682034f292d7ef72ec46f432149be0df7574bf2d6e92e38c04` and 3,324,173,934 installed bytes. That prior work and its raw benchmark files remain unchanged. The upstream Qwen3.5-4B model card identifies Apache-2.0 licensing. Model weights are not covered by this app's MIT license and are not included here. [Official model card](https://huggingface.co/Qwen/Qwen3.5-4B), [exact Ollama model tag](https://ollama.com/library/qwen3.5:4b-q4_K_M).

Only text was used for inference; images, tools, hosted AI and model downloads are outside this prototype. The earlier benchmark does not establish accuracy for the frozen implementation. The frozen internal evaluation is recorded separately under artifacts/model-check; its initial restricted preflight failure is preserved alongside the later approved live run.

## Optional QA tooling

The existing bundled Playwright 1.62.1 was discovered for QA (the earlier environment note said 1.57). Playwright is Apache-2.0; installed Chrome/Chromium retain their respective distribution licenses. They are not shipped as project dependencies or in the source archive. Initial restricted launches failed; the parent-authorized reviewed context rendered using sandbox-enabled Chromium 151. [Playwright license](https://github.com/microsoft/playwright/blob/main/LICENSE).

PayPal APIs and sandbox services remain subject to PayPal's terms and user authorization. This build neither accepts agreements nor creates accounts. No PayPal SDK package or remote script is embedded in the app; the server implements the documented Orders v2 redirect flow. PayPal credentials and actual provider calls are absent from the build/evaluation artifacts.
