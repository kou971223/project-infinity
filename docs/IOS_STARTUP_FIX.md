# CHG-IOS-STARTUP-1 — scope and pre-test acceptance

User defect: iPhone tab became unavailable after local AI startup; supplied progress screenshots show model_q4f16.onnx at 26/54 percent, not completed initialization. /health was accessible. Root cause of the tab crash is UNKNOWN; memory pressure and GPU/runtime incompatibility are hypotheses, not confirmed diagnostics.

The earlier PR9 q8-to-q4 claim is corrected before publication: the pinned HF revision reports q4 786156820 bytes, q8 512096557 bytes, q4f16 483003582 bytes. File size is not peak runtime memory. Keep CPU q8 and bypass GPU on iPhone/iPad; do not call this a proven memory fix.

Pre-test acceptance for this repair (not a Project Infinity completion matrix):
1. No false ready before the actual worker ready message. Show download vs initialization, with elapsed time and a stop action.
2. Input works before/during model load. One queued message is dispatched exactly once only after ready.
3. New conversation works when idle/loading/ready/generating. During load it clears conversation/queued send without starting a second model. Stopped/replaced workers cannot append stale replies.
4. Load exception, worker-constructor failure, cancellation and timeout release worker and expose retry. Preserve unsent text; no infinite retries.
5. iPhone/iPad automatic startup requests CPU, not WebGPU. Existing generated backend policy is not modified by this UI change.
6. Research records are behind an explicit button, distinguish historical execution/adoption and keep original raw records available. No claim of chat-weight inheritance or system completion.
7. Input >=16px; no horizontal overflow at 390px; header/composer do not overlay the scroll region. IME Enter does not submit.
8. Existing Node tests plus browser fault-injection tests and actual model two-turn inference must pass on final changed files before merge. Browser tests are not iPhone hardware validation.
9. No paid inference API, account/billing/resource change, private-chat publication, or automatic model upgrade.

Verification results must be recorded separately after execution. Physical iPhone startup remains unverified unless the user or a real device test confirms it.
