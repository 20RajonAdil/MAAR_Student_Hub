import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────
// AI Tutor endpoint. Runs server-side only:
//  - the OpenRouter API key never reaches the browser
//  - the underlying model name never reaches the browser (or the student)
//  - only the context the request actually needs is forwarded to the model
//  - if the primary/free model is rate-limited or briefly unavailable, we
//    transparently retry the SAME request (same system prompt, same full
//    conversation history) against the next model in the chain, so the
//    student never sees a model switch — just a normal reply, or, if every
//    model in the chain is down, one friendly "try again shortly" message.
//
// Set OPENROUTER_API_KEY in your environment (.env.local locally, or your
// host's secrets manager in production). Never commit the key.
// ─────────────────────────────────────────────────────────────────────────

// Ordered failover chain. The first entry is the "primary" model; the rest
// are free-tier fallbacks tried in order only on *transient* errors (429
// rate limit, 408 timeout, 5xx, or a network abort) — never on things like
// a bad API key or an unrecoverable 400, since retrying those just wastes
// time for the same failure.
//
// Override via env (comma-separated) if you want to change the lineup
// without touching code, e.g.:
//   MAAR_TUTOR_MODEL_CHAIN="anthropic/claude-sonnet-4.5,meta-llama/llama-3.3-70b-instruct:free,google/gemini-2.0-flash-exp:free,mistralai/mistral-7b-instruct:free"
const MODEL_CHAIN: string[] = (
  process.env.MAAR_TUTOR_MODEL_CHAIN ||
  [
    process.env.MAAR_TUTOR_MODEL || "anthropic/claude-sonnet-4.5",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "mistralai/mistral-7b-instruct:free",
    "qwen/qwen-2.5-72b-instruct:free",
  ].join(",")
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

// HTTP statuses worth failing over on (rate limits / transient unavailability).
const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

// Small delay before trying the next model, so we're not hammering
// OpenRouter in a tight loop if several models are rate-limited at once.
const RETRY_DELAY_MS = 350;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface TutorContext {
  studentName?: string;
  educationLevel?: string;
  examBoard?: string;
  subjectName?: string;
  currentTopic?: string;
  recentWeaknesses?: string[];
  noteExcerpts?: { title: string; excerpt: string }[];
  allowExternalKnowledge?: boolean;
}

interface TutorRequestBody {
  messages: { role: "student" | "tutor"; content: string }[];
  context: TutorContext;
}

const SYSTEM_PROMPT = (ctx: TutorContext) => `You are the AI Tutor inside MAAR Study Hub, an educational assistant — not a replacement for a real teacher.

Ground rules:
- Teach, don't just answer. When asked a homework-style question, guide the student toward the method with hints and step-by-step reasoning, and let them attempt the next step before revealing the full solution. Only give the complete final answer if the student clearly wants a worked example after trying, or explicitly asks for it.
- Prefer the student's own notes/resources (given below) over general knowledge when they're relevant. If you use outside knowledge beyond what's provided, say so plainly (e.g. "This isn't from your notes, but generally...").
- Never invent facts, sources, exam-board requirements, or marks. If you don't have enough information, ask a clarifying question instead of guessing.
- If something the student says conflicts with a trusted source, explain the conflict gently and ask them to double check — don't just declare them wrong.
- Be encouraging and specific. Never shame a student for a wrong answer or a weak area — frame it as something to improve together.
- Keep answers concise for simple questions, and more thorough when actually teaching a concept.

Student context (use only what's relevant to the current question — don't force it in):
- Name: ${ctx.studentName ?? "unknown"}
- Level: ${ctx.educationLevel ?? "unspecified"}${ctx.examBoard ? `, exam board: ${ctx.examBoard}` : ""}
- Subject: ${ctx.subjectName ?? "general"}${ctx.currentTopic ? `, current topic: ${ctx.currentTopic}` : ""}
- Recent weak areas: ${ctx.recentWeaknesses?.length ? ctx.recentWeaknesses.join(", ") : "none on record"}
${ctx.noteExcerpts?.length ? `\nRelevant note excerpts:\n${ctx.noteExcerpts.map((n) => `[${n.title}]\n${n.excerpt}`).join("\n\n")}` : ""}
`;

// Allow extra time for a full teaching response — actual ceiling still
// depends on your hosting plan (e.g. Vercel Hobby caps function duration
// regardless of this value; Pro/Enterprise honour it).
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The AI Tutor isn't configured yet. Add OPENROUTER_API_KEY to your server environment." },
      { status: 503 }
    );
  }

  let body: TutorRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body?.messages?.length) {
    return NextResponse.json({ error: "No message provided." }, { status: 400 });
  }

  // Same system prompt + same full conversation history is sent on every
  // attempt in the chain — only the `model` field changes between tries.
  const openRouterMessages = [
    { role: "system", content: SYSTEM_PROMPT(body.context ?? {}) },
    ...body.messages.map((m) => ({
      role: m.role === "student" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
  ];

  // Attempt log kept server-side only, for diagnosing failover behaviour in
  // function logs. Never sent to the browser.
  const attempts: { model: string; status?: number; note?: string }[] = [];

  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i];
    const isLastModel = i === MODEL_CHAIN.length - 1;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 28000);

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          // OpenRouter asks apps to identify themselves — this is not the model name.
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://maar-student-hub.vercel.app",
          "X-Title": "MAAR Study Hub",
        },
        body: JSON.stringify({
          model,
          messages: openRouterMessages,
          temperature: 0.4,
          max_tokens: 900,
        }),
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        // Log the real upstream status/body server-side only — never sent
        // to the browser — so this is diagnosable from function logs
        // without ever exposing the key or the model name to the student.
        console.error("OpenRouter error", model, res.status, errText);
        attempts.push({ model, status: res.status });

        const retryable = RETRYABLE_STATUSES.has(res.status);
        if (retryable && !isLastModel) {
          await sleep(RETRY_DELAY_MS);
          continue; // silently fail over to the next model in the chain
        }

        // Not retryable (bad key, no credit, malformed request, etc.), or
        // we've exhausted the chain — surface a specific, student-safe
        // message instead of one generic sentence for every failure.
        let message: string;
        switch (res.status) {
          case 401:
          case 403:
            message = "The AI Tutor's API key looks invalid or expired. (Check OPENROUTER_API_KEY in your host's environment settings.)";
            break;
          case 402:
            message = "The AI Tutor is out of credit on OpenRouter. Add credit to the OpenRouter account and try again.";
            break;
          case 404:
            message = "The AI Tutor's configured model isn't available right now. (Check MAAR_TUTOR_MODEL_CHAIN.)";
            break;
          case 408:
            message = "The AI Tutor took too long to respond. Please try again.";
            break;
          case 429:
            // Every model in the chain was rate-limited — this is the
            // friendly, non-technical message the student actually sees.
            message = "Our free AI Tutor models are all a bit busy right now — please try again in a minute or two. Nothing you wrote was lost.";
            break;
          default:
            message =
              res.status >= 500
                ? "Our AI Tutor models are all a bit busy right now — please try again in a moment. Nothing you wrote was lost."
                : `The AI Tutor couldn't respond just now (error ${res.status}). Please try again in a moment.`;
        }
        return NextResponse.json({ error: message }, { status: 503 });
      }

      const data = await res.json();
      const reply: string | undefined = data?.choices?.[0]?.message?.content;
      if (!reply) {
        attempts.push({ model, note: "empty reply" });
        if (!isLastModel) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        return NextResponse.json({ error: "The AI Tutor didn't return a response. Please try again." }, { status: 503 });
      }

      if (attempts.length) {
        // A failover happened. Log it server-side only for observability —
        // the response body below still never mentions which model or how
        // many attempts it took, by design.
        console.info("Tutor failover succeeded", { attempts, succeededModel: model });
      }

      // Model identity is intentionally stripped from the response before
      // it ever leaves the server — the student only ever sees "the AI
      // Tutor", never which underlying model answered.
      return NextResponse.json({ reply });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      console.error("Tutor route attempt failed", model, timedOut ? "timeout" : err);
      attempts.push({ model, note: timedOut ? "timeout" : "network error" });

      if (!isLastModel) {
        await sleep(RETRY_DELAY_MS);
        continue; // network hiccup / timeout — try the next model
      }
      return NextResponse.json(
        { error: "Our AI Tutor models are all a bit busy right now — please try again in a moment. Nothing you wrote was lost." },
        { status: 503 }
      );
    }
  }

  // Defensive fallback — should be unreachable since the loop above always
  // returns, but keeps TypeScript happy and guarantees a friendly response.
  return NextResponse.json(
    { error: "Our AI Tutor models are all a bit busy right now — please try again in a moment. Nothing you wrote was lost." },
    { status: 503 }
  );
}
