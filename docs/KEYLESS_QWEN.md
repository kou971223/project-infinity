# Anonymous Qwen conversation transport

The previous Pollinations `openai-fast` endpoint currently returns HTTP 500 (including an observed ENOSPC failure) or refuses anonymous generation. The legacy transport is retained for regression/comparison; normal chat no longer sends to it.

The replacement calls the **official Qwen/Qwen3-Demo public Space**, via `@gradio/client@2.7.1`. The public app configuration and actual response headers identify `Qwen3-235B-A22B`. This is provider-reported identity, not independent weight inspection. Public source revision examined: `60e1db0778067d36b8a2793c350bf85cd461a298`.

The anonymous client uses no account, token, secret, payment registration or paid fallback. Hugging Face documents public Spaces as API endpoints, with authentication required for private Spaces. The inspected Space is a CPU Basic proxy to its owner's Alibaba Cloud backend, not a client-side model or a ZeroGPU model hosted by this project. Provider-owned credentials are not accessed, copied or embedded. Anonymous availability, queue capacity, terms and future free access remain external dependencies; unlimited usage is not promised.

## Runtime boundaries

- A fresh network worker and Gradio session per request isolate conversations. Only the explicit browser-supplied recent history and selected public source excerpts are submitted, using a POST body.
- The public demo ignores a native system-role input. Project instructions and role-tagged history are therefore serialized into a single text input. `/no_think` requests concise direct output. This is a tested text-context adapter, not a claim that native chat-role semantics are identical.
- Only calls to the fixed HTTPS Space origin are allowed. Redirects, alternate hosts and credential headers are rejected even if remote configuration changes. No model files or Gradio client code run on the phone.
- A 55-second worker deadline, worker heap limit, event/output limits, explicit completion status, expected model header and success footer reject partial/failed output. Reasoning/tool/UI fields are discarded. Worker termination closes connections; cancellation is also sent to the public queue.
- No raw prompts, replies or provider error bodies are logged by Project Infinity. The provider processes the submitted content and may retain it; the chat footer names Hugging Face / Alibaba Cloud before submission.
- Requests remain serialized with a 16-second cooldown. This is an application courtesy limit, not a claimed published quota for this demo.

## Evidence and release gate

The comparison artifact contains synthetic Japanese instruction, context recall and multiplication requests with paired legacy/candidate outcomes. Failure to answer is recorded separately from wrong answers. These samples establish current functionality only, not general superiority over GPT-OSS 20B or guaranteed reliability.

Local protocol tests also cover malformed/partial output, incorrect identity, history serialization, forbidden network targets, credentials, worker failure, timeout, cancellation and HTTP routing. Real Chromium/WebKit two-turn tests and the exact production commit gate must pass before a release is accepted.

Official references:
- https://huggingface.co/docs/hub/spaces-api-endpoints
- https://gradio.app/docs/js-client
- https://huggingface.co/spaces/Qwen/Qwen3-Demo/blob/main/app.py

Overall scope remains EXPERIMENTAL_PARTIAL: source retrieval and generated arithmetic programs can affect replies after independent adoption, while the externally hosted foundation weights remain unchanged. Physical iPhone verification and RSI are not established.
