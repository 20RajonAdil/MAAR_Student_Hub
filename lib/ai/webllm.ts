"use client";

// ─────────────────────────────────────────────────────────────────────────
// On-device AI tutor fallback, built on WebLLM (@mlc-ai/web-llm).
//
// Used automatically when the cloud OpenRouter tutor is exhausted (out of
// credit / rate-limited on every configured model) or unreachable. Runs
// entirely in the browser via WebGPU:
//  - no API key, no account, no server-side inference
//  - the model file is fetched once from the WebLLM CDN and cached by the
//    browser's Cache Storage, so later sessions (including fully offline
//    ones, once cached) don't re-download it
//  - nothing about the student's question, notes or resources leaves the
//    device for this path
//
// Model choice: Llama-3.2-3B-Instruct on capable devices, falling back to
// Llama-3.2-1B-Instruct on lower-memory devices/phones. Both ship as
// official WebLLM prebuilt models. 3B is the largest Llama 3.2 *instruct*
// size that reliably fits in-browser via WebGPU on an ordinary laptop
// (roughly 2.2GB of VRAM/RAM for the q4f16_1 build); the full 8B+ Llama
// 3.1/3.2 variants are impractical for a browser tab on typical student
// hardware, which is why 3B (not a larger Llama) was chosen — see the
// implementation report for the full reasoning.
// ─────────────────────────────────────────────────────────────────────────

import type { MLCEngine, InitProgressReport } from "@mlc-ai/web-llm";

const MODEL_STANDARD = "Llama-3.2-3B-Instruct-q4f16_1-MLC";
const MODEL_LITE = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

// Answers from the local model are capped to keep replies readable and
// consistent in length with the cloud tutor's replies.
const MAX_LOCAL_ANSWER_LINES = 20;

export type WebLLMAvailability =
  | { supported: true }
  | { supported: false; reason: "no-webgpu" | "unsupported-browser" };

let enginePromise: Promise<MLCEngine> | null = null;
let loadedModelId: string | null = null;

export function checkWebLLMAvailability(): WebLLMAvailability {
  if (typeof window === "undefined") return { supported: false, reason: "unsupported-browser" };
  if (!("gpu" in navigator)) return { supported: false, reason: "no-webgpu" };
  return { supported: true };
}

// Rough, conservative heuristic — navigator.deviceMemory is only available
// in Chromium browsers and reports RAM in GB, not VRAM, but it's the best
// signal available from the browser without actually trying to allocate
// GPU buffers. Devices that don't report it are treated as capable rather
// than penalised, since Safari/iOS (WebGPU support still rolling out) and
// many desktops simply don't expose the field.
function pickModelForDevice(): string {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === "number" && mem <= 4) return MODEL_LITE;
  return MODEL_STANDARD;
}

export interface WebLLMLoadProgress {
  text: string;
  progress: number; // 0-1
}

async function getEngine(onProgress?: (p: WebLLMLoadProgress) => void): Promise<MLCEngine> {
  const modelId = pickModelForDevice();

  if (enginePromise && loadedModelId === modelId) return enginePromise;

  const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
  loadedModelId = modelId;
  enginePromise = CreateMLCEngine(modelId, {
    initProgressCallback: (report: InitProgressReport) => {
      onProgress?.({ text: report.text, progress: report.progress });
    },
  }).catch((err) => {
    // Reset so a retry actually retries instead of replaying a rejected
    // promise (e.g. after a corrupted/partial cache on first attempt).
    enginePromise = null;
    loadedModelId = null;
    throw err;
  });
  return enginePromise;
}

function capToLines(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join("\n").trimEnd() + "\n…(trimmed for length — ask a follow-up for more)";
}

export interface WebLLMAnswerResult {
  reply: string;
  elapsedMs: number;
  modelUsed: "standard" | "lite";
}

export async function answerLocally(
  systemPrompt: string,
  messages: { role: "student" | "tutor"; content: string }[],
  onProgress?: (p: WebLLMLoadProgress) => void
): Promise<WebLLMAnswerResult> {
  const startedAt = Date.now();
  const engine = await getEngine(onProgress);

  const chat = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({
      role: (m.role === "student" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    })),
  ];

  const completion = await engine.chat.completions.create({
    messages: chat,
    temperature: 0.4,
    max_tokens: 500,
  });

  const raw = completion.choices?.[0]?.message?.content ?? "";
  return {
    reply: capToLines(raw.trim(), MAX_LOCAL_ANSWER_LINES),
    elapsedMs: Date.now() - startedAt,
    modelUsed: loadedModelId === MODEL_LITE ? "lite" : "standard",
  };
}

export function isWebLLMReady(): boolean {
  return enginePromise !== null;
}
