# Core 0.5 — continuity, not final Project Infinity acceptance

Change: CHG-CORE05-001. Design priority: evidence, independence disclosure, provenance.
Acceptance epoch: PINF-AUTONOMY-1, fixed before the first experimental job.
The original Project Infinity goals are NOT weakened or marked complete.

## Implemented paths
- Public source inventory, previous negative results, and fresh arXiv metadata as research inputs. A metadata fetch is NOT full-paper verification.
- A locally executed, revision-pinned pretrained model proposes source edits. Unique anchored edits become code, not instructions added to a chat prompt.
- Candidates can propose changes to four ordinary application/UI files in this epoch. Generated code is only smoke-tested inside a read-only, networkless, non-root Docker container; no host evaluation, repository token, hidden secrets, or publish authority is available.
- Generic source edits are **never auto-merged** on the strength of exit codes. Separate research-source/ branches can preserve tested proposals without triggering unisolated candidate/** CI. Application-wide autonomous adoption remains unresolved.
- Two independent training seeds from the SAME frozen parent, same fixed 32-step training budget. Each candidate is frozen before a newly generated confirmatory set. Candidate 0 is predetermined for release; no best-of-two selection.
- A deterministic publication job recomputes loss/regression acceptance. Unsupported updates keep the old active checkpoint. An accepted norm is read by the NEXT research instance and is used for actual generation/training.
- A further new job reads the published accepted checkpoint and performs actual text generation. This verifies loading/use, not research quality or RSI.
- Public evidence records include parent record hash, parent/child weight hashes, source inventory, errors, and the actual GitHub event. push is never called scheduled execution.
- Standard public GitHub-hosted CPU jobs only; no paid inference API, purchased services, large runners or cache/artifact uploads in the new workflow.

## What the training measures
Only 896 final-normalization parameters of Qwen2.5-0.5B-Instruct are mutable. The experimental objective remains English next-token loss on a synthetic research-prose template. The template, author, model and tokenizer are shared dependencies. Two seeds are internal replication, NOT two independent scientific studies. No inference that the Japanese chat model, general intelligence, or research ability improved is justified.

32 steps rather than Core 0.4's 8 is an explicitly increased compute budget; improvement cannot establish E2 efficiency. The minimum mean loss reduction stays 0.01, each heldout document must improve, and each anchor loss increase must be at most 0.05. A new epoch, not a retroactive relabeling of an old failed result. Three accepted generations then require fresh construct/evaluation review.

## Boundaries and residual risk
The browser model remains unchanged. Experimental research checkpoints are not automatically exported to ONNX or applied to the chat. Container isolation is defense in depth, not a proof against kernel exploits. Smoke-test exit codes are candidate-influenceable and cannot authorize general-source promotion. The publisher and evaluator share the project author and codebase. Administrator-level rewriting of the full Git history is not prevented by hashes.

This release does not provide app-wide verified self-modification, external independent validation, unlimited improvement, persistent 24/7 execution, or RSI evidence. It does not mark the master specification Accepted.

## Reproducible verification
python3 -m unittest discover -s test -p 'test_*.py' -v
npm test
python3 autonomy/cycle.py (requires listed CPU dependencies and public model download)
python3 autonomy/verify_inheritance.py
Actual results live on the data-only research-records branch. Local contracts passing do not imply remote inference or acceptance passed.

Sources checked 2026-10-02:
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- https://docs.docker.com/engine/containers/run/
- Model revision is inherited from Core 0.4: 7ae557604adf67be50417f59c2c2f167def9a775. A pinned model-card fetch was unavailable during this change; the model revision and license are not independently re-certified here.
