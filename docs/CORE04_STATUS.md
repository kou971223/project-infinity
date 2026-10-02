# Core 0.4 verification record

Original Project Infinity Master Specification remains NOT Accepted. This version does not lower its acceptance thresholds.

## Verified before browser release

- GitHub run 36956736700: local Qwen2.5-0.5B-Instruct loaded on CPU, generated candidate text and performed 8 gradient steps on the pretrained final normalization parameter.
- Weight hash changed. The loss-reduction experiment returned NOT_SUPPORTED: mean reduction 0.003533442815144857 did not meet its preregistered 0.01 requirement. The checkpoint was not adopted.
- The generated code candidate failed CANDIDATE_SCHEMA. No unsafe fallback or invented success.
- That revision passed 47 Node tests and 8 Python tests on GitHub.

## New user-facing surface

Browser-local Qwen via pinned Transformers.js/ONNX revision. No paid inference API. First use requires approximately 500 MB of public weights. Device compatibility, network data charges and power consumption are not guaranteed away. Chat history stays in browser storage, not public research records. A lightweight model is not equivalent to frontier ChatGPT.

Real browser verification is a separate workflow; its result must be checked before claiming working inference. Chromium mobile viewport is not a real iPhone Safari test.

## Unattended work

Bounded code research uses the existing hourly workflow. The CPU-model experiment is configured every 6 hours, not continuously every second. Workflow configuration and successful schedule-triggered execution are separate facts. Runs store public synthetic experiment records on a data-only branch after merge. The writer cannot target arbitrary paths or main. Current research restarts from a frozen base model; it is not evidence of multi-generation learned-weight inheritance.

## Still not achieved

Application-wide autonomous code changes, generally capable autonomous AI research, adoption of improved model weights into the chat model, external independent validation, and RSI evidence. Existing bounded module tests/promotion are not substitutes for those requirements.

## Cost boundary

No card registration, new paid service or paid inference API. Use standard public-repository Actions only; private-repository runs are disabled. No upload-artifact in the new CPU workflow. No model token/credential is given to generated candidates.
