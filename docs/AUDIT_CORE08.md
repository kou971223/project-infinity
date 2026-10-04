# Audit — Core 0.8, 2026-10-04

## Baseline evidence

Repository main: `2eb9f163310a048fcbfd4584da9ae46e7cd6872e`.
Render service `srv-davgctid0e5s73ft6e1g`, Singapore, free plan, main, npm install / npm start, autoDeploy=yes.
Live deployment `dep-davou760tbcc73eqf800` served that SHA. Error-log query returned no entries; absence of logs is not proof of no failures.
Baseline Node: 78 passed. Python: 39 passed.
PRs #7 and #8 remain unmerged: both return to browser-local chat learning and are incompatible with the current iPhone exclusion. They were not adopted or silently closed.

## Defects and corrective design

- Old README instructed failed iPhone-local inference, despite production remote inference. Replaced with current architecture.
- New chat destroyed the only stored conversation. Added bounded multi-conversation storage, legacy migration and export.
- Shared request globals allowed old finally/catch to mutate new chat/request state. Added request identity guards, per-chat request capture and cancellation.
- No retry preserved failed turn; retyping could duplicate a user message. Retry now reuses the same pending turn.
- GET upstream put conversation in URL. Replaced with POST structured messages at the confirmed anonymous endpoint.
- Plain text accepted HTML or provider errors as an answer. JSON choice validation now requires finish_reason=stop and bounded body/content.
- Removed dormant paid OpenAI route and secret configuration placeholders. Fixed endpoint; no paid/credential fallback.
- Existing synthesized response extractor was disconnected from actual remote chat. Canonical response adaptation now calls its guarded execution/rollback path.
- Health returned old UI revision; consolidated current version/UI revision.
- Live browser job tested obsolete local loader and only ran when its own YAML changed. Now exact SHA, every main push, Chromium/WebKit, context recall and production API.
- A generated source passing smoke tests remains REVIEW_REQUIRED; cannot touch evaluator/tests/workflows or become production by its own judgment.
- Weight epoch at generation 3 remains DEFER_EPOCH_HOLDOUT_REVIEW. Extra generation is not permitted by the existing protocol. New source-research lane can run while weights are held.

## Inference comparison actually checked

| Option | Observed | Decision |
| --- | --- | --- |
| Existing anonymous `text.pollinations.ai` | `/models`: one entry `openai-fast`, GPT-OSS 20B Reasoning LLM (OVH), tier anonymous, alias openai. GET test returned PINF_OK. | Retain provider; canonical model name. |
| Anonymous POST `/` | 200; arithmetic 17×19 -> 323, 12.83 s from audit environment | Validated POST path. |
| Anonymous POST `/openai` | 200; JSON model `gpt-oss-20b`, user_tier anonymous; instructed code returned, 17.59 s | Adopt structured protocol for completion/error validation. |
| `gen.pollinations.ai/v1/chat/completions` | No-key request returned 401; official API docs require key for inference | Ineligible; no paid calls or registration. |
| Puter.js | Official user-pays docs require account; monthly free allowance then upgrade prompt | Not adopted as an unconditional free replacement. |

Two small prompts are integration checks, not broad model-performance benchmarks. No verified superior eligible model was found in these checked options. Provider reported identity is not a weight attestation. Legacy availability conflicts with blanket claims that all legacy inference was retired: this audit records the directly observed working anonymous path and does not assume permanent support.

Official sources:
- https://text.pollinations.ai/models
- https://github.com/pollinations/pollinations/blob/main/APIDOCS.md (read on audit date; new gateway auth requirements)
- https://docs.puter.com/user-pays-model/
- https://render.com/docs/free
- https://docs.github.com/en/billing/concepts/product-billing/github-actions

## Limits kept explicit

Render free filesystem is ephemeral, no free persistent disk. Private conversations stay in browser; public research evidence survives in GitHub. Free service sleeps after 15 minutes; startup may take about a minute. No keep-alive evasion. Public standard Actions compute is free but schedules have service limits and can be delayed/disabled; no eternal background process or guarantee of zero future infrastructure billing is inferred from plan name. No spending settings were changed.

The new lane uses candidate-only external text inference on PUBLIC code. Test runners have no publication credential; validator runs candidate runtime only inside the existing networkless/read-only/CPU-memory-time-limited Docker sandbox. Publication is a separate job writing only data paths on research-records. Bounded historical publishers retain their existing allowlists; no acceptance criteria are lowered.

General source changes require an independently reviewed PR with full CI before main. Full arbitrary self-modification and demonstrated general-intelligence improvement remain unmet. External hosted chat weights cannot inherit local experiment weights. Physical iPhone tests and long-horizon operation cannot be declared passed from desktop emulation.

## Acceptance evidence

Candidate automatic tests, browser runs, merge SHA and production post-deploy results are tracked in the PR/Actions. Before those results exist, this document is an audit and implementation description, not a declaration that release validation passed.

## Candidate failure correction

Initial browser fault-injection passed both engines, but burst real-inference requests encountered HTTP 401/402. Legacy endpoint-linked official documentation specifies one anonymous request per 15 seconds. Added a server-side 16-second start-slot pacer, removed duplicate candidate push/PR browser runs, and separated source-generation schedule from release test bursts. This respects the public quota rather than retrying with credentials or alternate identities. Non-success responses still fail closed. Successful reruns are required; this change alone is not proof of upstream reliability.
Source: https://github.com/pollinations/pollinations/blob/master/APIDOCS.md (anonymous limits section; accessed through the legacy endpoint redirect).
