# CHG-CHAT-MEASUREMENT-002: deployed runtime, not a native proxy

Old: PINF-CHAT-NORM-1 / native ONNX Runtime 1.23.2 CPUExecutionProvider.
New: PINF-CHAT-NORM-2 / PINF-CHAT-WASM-EVAL-1, Transformers.js 3.8.1 WASM in Chromium.

Evidence: diagnostic workflow run 36973060409 compared the identical pinned model and token IDs. Native default optimization and disabled optimization both returned incoherent responses to the Tokyo and 2+3 probes. Actual browser WASM returned Tokyo and 5 for exactly the same prompt tokens, greediness, repetition penalty 1.0 and token budget. This establishes a runtime discrepancy. It does NOT identify the kernel-level cause. Native CPU quantization saturation is a known possibility in the official ONNX Runtime quantization documentation, not a proven diagnosis here.

The native outcomes remain rejected under their old epoch, including 36972181278 and 36972613608; no old result is overwritten as a pass. The discrepancy means those numbers are not a validated proxy for the browser model. The raw native reference function and non-promoting diagnostic remain reproducible.

All task counts, minimum gain 0.01, per-item improvement requirement, mean/worst anchor limits, baseline minimum QA passes and zero QA regression rules remain unchanged. Same candidate weights, same pinned base bytes. New fresh target identifiers are generated after freeze. The WASM evaluator uses production's repetition penalty 1.1 for BOTH baseline and candidate, instead of the manual native loop's missing penalty. This is explicitly an evaluator/implementation change, not improved weights or a claim of independence. A browser-loading/rollback test is still separately required after measured acceptance. No fallback to publishing failed candidates.

Shared dependencies remain: author, model, tokenizer, synthetic template, fixed anchor/QA tasks, Transformers.js. General quality and RSI are not established. Source: https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html (read 2026-10-02), data-type/saturation discussion. No inference that every native runtime is incorrect.
