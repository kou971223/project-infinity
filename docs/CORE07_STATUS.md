# Core 0.7: trained-weight to real-chat bridge

CHG-CORE07-001 adds a transport and deployment path, not a declaration of Project Infinity completion.
New bounded acceptance epoch: PINF-CHAT-NORM-1. Original Master Specification criteria remain unchanged.

## Actual path
An already accepted experimental checkpoint on research-records is frozen by Git commit and tensor hash.
The exact 896 float32 final-normalization parameters are inserted into a pinned ONNX quantized model.
The full original model SHA-256, tensor offset/length/name discovery, original tensor hash and resulting model hash are recorded.
The ONNX graph and all other tensors remain unchanged. Only public model files and synthetic tasks are used.

The evaluator compares baseline/candidate using the actual quantized runtime: 12 fresh identifiers in the original English research-prose template, 12 fixed multilingual text anchors, and 8 fixed short Japanese QA/instruction cases.
Minimum target mean loss reduction remains 0.01; every target must improve. Worst anchor loss increase must be at most 0.05 and mean at most 0.01. Existing QA successes may not regress; baseline must pass at least four of eight.
These are compatibility/transport checks, not broad Japanese quality, scientific productivity, OOD intelligence or RSI evidence. Fixed anchors and the template are shared dependencies.

After that gate, an actual browser loads the proposed tensor, checks every model chunk, runs two turns, reloads the accepted tensor, and restores the base model. A separate trusted write job recomputes numerical gates, checks identities and browser evidence, and writes only a data manifest on research-records. Generated programs receive no evaluator/promotion credentials.

The application reads this manifest at startup. If no validated release exists, integrity checks fail, or the user chooses rollback, it uses the original public model. Learned-model inference failure or timeout retries once on the base model. No paid inference fallback exists.

## Scope and trade-offs
The first transport supports WASM/q8 CPU inference. Learned weights may load more slowly than the unchanged GPU path; no speed/efficiency gain is claimed. Validation uses Chromium Linux, not an iPhone. Streaming one-MiB chunk verification avoids a second full-model buffer, but actual device memory limits remain.
The browser stores ordinary conversation history locally; it is not posted to training or public Git.
Hash checking does not stop an administrator from rewriting an entire trusted repository.
Existing source-code research and experimental weight learning remain distinct. Application-wide self-rewriting and independently demonstrated recursive improvement remain unaccepted.

## Automation
The new job can run after Autonomous research continuity completes, manually, or on its six-hour schedule. A saved schedule is not proof of scheduled execution. Standard public Ubuntu runners only; no paid API, large runner, new service, Actions artifact upload or cache upload. Small public records are preserved in Git.
No approval threshold was weakened in response to a failed result. Failures retain the old active chat release.

## Evidence sources checked 2026-10-02
- https://huggingface.co/docs/transformers.js/v3.8.1/api/env : supported custom cache response interface.
- https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct : pinned binary; SHA-256 independently computed during inspection.
- https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct : underlying public model.
- https://pypi.org/project/onnxruntime/1.23.2/ : selected Python CPU runtime, Python >=3.10.
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows : workflow_run and schedule behavior.

## Completion
Implementation and test results are separate. A release is installed only with actual ONNX and browser evidence. Overall Project Infinity is NOT Accepted by this subsystem's results.
