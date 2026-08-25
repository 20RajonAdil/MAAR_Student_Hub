// ─────────────────────────────────────────────────────────────────────────
// Server-only list of OpenRouter models the tutor tries, in order, for one
// request. Names never reach the browser — the client only ever sees
// "the AI Tutor", not which model answered.
//
// 27 models by default. Worth knowing: this is a big list to fall through
// sequentially — see the shortened per-model timeout in
// app/api/tutor/route.ts, which trades "wait for a slow model" for "move
// on quickly" specifically so a bad run of early failures doesn't leave a
// student staring at a spinner for minutes before the local fallback
// kicks in.
//
// Override with MAAR_TUTOR_MODELS (comma-separated OpenRouter model slugs)
// if you want a different lineup or the catalogue has moved on since this
// was written. Check https://openrouter.ai/models for current slugs,
// pricing and context sizes before relying on this list in production —
// OpenRouter's catalogue changes over time and a slug can be renamed or
// retired; some of these (e.g. the 405B/large models) are also
// significantly slower/pricier per request than the first few in the list.
// ─────────────────────────────────────────────────────────────────────────

export const DEFAULT_TUTOR_MODELS = [
  "anthropic/claude-sonnet-4.5",
  "openai/gpt-4.1-mini",
  "google/gemini-2.5-flash",
  "meta-llama/llama-3.3-70b-instruct",
  "qwen/qwen-2.5-72b-instruct",
  "deepseek/deepseek-chat",
  "mistralai/mistral-large-2411",
  "x-ai/grok-2-1212",
  "cohere/command-r-plus",
  "amazon/nova-pro-v1",
  "meta-llama/llama-3.1-405b-instruct",
  "qwen/qwen-2.5-coder-32b-instruct",
  "mistralai/mixtral-8x22b-instruct",
  "google/gemini-2.0-flash-001",
  "openai/gpt-4o-mini",
  "anthropic/claude-3.5-haiku",
  "deepseek/deepseek-r1",
  "meta-llama/llama-3.1-70b-instruct",
  "qwen/qwq-32b-preview",
  "microsoft/phi-4",
  "nousresearch/hermes-3-llama-3.1-405b",
  "ai21/jamba-1.5-large",
  "mistralai/mistral-nemo",
  "google/gemma-2-27b-it",
  "meta-llama/llama-3.2-90b-vision-instruct",
  "perplexity/llama-3.1-sonar-large-128k-online",
  "thudm/glm-4-32b",
];

export function getTutorModels(): string[] {
  const fromEnv = process.env.MAAR_TUTOR_MODELS?.split(",").map((s) => s.trim()).filter(Boolean);
  return fromEnv?.length ? fromEnv : DEFAULT_TUTOR_MODELS;
}

// Upstream statuses that mean "this particular model/account is out of
// runway right now" — worth trying the next model in the list for.
// Anything else (bad request, auth failure) isn't fixed by trying a
// different model, so we stop immediately instead of burning through the
// whole list on a request that will fail everywhere the same way.
export const RETRYABLE_STATUSES = new Set([402, 404, 408, 429, 500, 502, 503, 504]);

// Statuses that specifically mean "no credit / no capacity left" as
// opposed to a transient blip — used to decide whether to tell the client
// "all cloud models are exhausted, fall back to the local model" rather
// than just "try again".
export const EXHAUSTION_STATUSES = new Set([402, 429]);
