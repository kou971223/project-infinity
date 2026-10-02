# Core 0.7 candidate — chat inheritance gate

Purpose: connect an accepted research checkpoint to the chat runtime without treating a training run as proof of general improvement.

This candidate adds a browser-side checkpoint contract. Only a checkpoint already published as accepted_experimental, with a positive generation and exactly 896 finite values, may be exposed to the chat integration layer. Missing, rejected or malformed evidence falls back to the frozen public chat model.

This is deliberately not a claim that the ONNX browser model has already consumed PyTorch norm weights. The remaining adapter/export step must prove parameter identity and numerical compatibility before mutation. No post-evaluation conversion is allowed to inherit old evidence without a new confirmatory evaluation.

Rollback invariant: failure to fetch, validate, convert, load, or confirm the checkpoint leaves the previous browser model active.

No paid service is introduced.
