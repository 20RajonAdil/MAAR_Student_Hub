import { NextRequest, NextResponse } from "next/server";
import { getTutorModels, RETRYABLE_STATUSES, EXHAUSTION_STATUSES } from "@/lib/ai/models";

// ─────────────────────────────────────────────────────────────────────────
// AI Tutor endpoint. Runs server-side only:
//  - the OpenRouter API key never reaches the browser
//  - the underlying model name never reaches the browser (or the student)
//  - only the context the request actually needs is forwarded to the model
//
// Set OPENROUTER_API_KEY in your environment (.env.local locally, or your
// host's secrets manager in production). Never commit the key.
//
// Cloud models are tried in order (see lib/ai/models.ts). If every model
// in the list is out of credit / rate-limited, this route responds with
// `allExhausted: true` instead of a generic error, so the client knows to
// switch to the on-device WebLLM tutor rather than just showing a failure.
// ─────────────────────────────────────────────────────────────────────────

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

export function tutorSystemPrompt(ctx: TutorContext) {
  return `You are the AI Tutor inside MAAR Study Hub, an educational assistant — not a replacement for a real teacher.

Ground rules:
- Teach, don't just answer. When asked a homework-style question, guide the student toward the method with hints and step-by-step reasoning, and let them attempt the next step before revealing the full solution. Only give the complete final answer if the student clearly wants a worked example after trying, or explicitly asks for it.
- Prefer the student's own notes/resources (given below) over general knowledge when they're relevant. If you use outside knowledge beyond what's provided, say so plainly (e.g. "This isn't from your notes, but generally...").
- Never invent facts, sources, exam-board requirements, or marks. If you don't have enough information, ask a clarifying question or say plainly that it isn't in the student's materials — never guess and present it as if it came from their notes.
- If something the student says conflicts with a trusted source, explain the conflict gently and ask them to double check — don't just declare them wrong.
- Be encouraging and specific. Never shame a student for a wrong answer or a weak area — frame it as something to improve together.
- Keep answers concise for simple questions, and more thorough when actually teaching a concept.

Student context (use only what's relevant to the current question — don't force it in):
- Name: ${ctx.studentName ?? "unknown"}
- Level: ${ctx.educationLevel ?? "unspecified"}${ctx.examBoard ? `, exam board: ${ctx.examBoard}` : ""}
- Subject: ${ctx.subjectName ?? "general"}${ctx.currentTopic ? `, current topic: ${ctx.currentTopic}` : ""}
- Recent weak areas: ${ctx.recentWeaknesses?.length ? ctx.recentWeaknesses.join(", ") : "none on record"}
${ctx.noteExcerpts?.length ? `\nRelevant excerpts from the student's own materials:\n${ctx.noteExcerpts.map((n) => `[${n.title}]\n${n.excerpt}`).join("\n\n")}` : "\nNo matching material was found in the student's notes or resources for this question — say so if the question depends on their specific course content."}
`;
}

function studentSafeMessage(status: number): string {
  switch (status) {
    case 401:
    case 403:
      return "The AI Tutor's API key looks invalid or expired. (Check OPENROUTER_API_KEY in your host's environment settings.)";
    case 402:
      return "The AI Tutor is out of credit on OpenRouter. Add credit to the OpenRouter account and try again, or let the on-device tutor take over.";
    case 404:
      return "One of the AI Tutor's configured models isn't available right now.";
    case 408:
      return "The AI Tutor took too long to respond.";
    case 429:
      return "The AI Tutor is getting a lot of requests right now.";
    default:
      return status >= 500
        ? "OpenRouter is having issues right now — this isn't something wrong with your account."
        : `The AI Tutor couldn't respond just now (error ${status}).`;
  }
}

// Allow extra time for a full teaching response, and for trying several
// models in sequence — actual ceiling still depends on your hosting plan
// (e.g. Vercel Hobby caps function duration regardless of this value;
// Pro/Enterprise honour it).
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // No cloud key configured at all — tell the client to go straight to
    // the local WebLLM tutor instead of erroring out.
    return NextResponse.json(
      {
        error: "The cloud AI Tutor isn't configured. Falling back to the on-device tutor.",
        allExhausted: true,
      },
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

  const openRouterMessages = [
    { role: "system", content: tutorSystemPrompt(body.context ?? {}) },
    ...body.messages.map((m) => ({
      role: m.role === "student" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
  ];

  const models = getTutorModels();
  const startedAt = Date.now();
  let lastMessage = "The AI Tutor couldn't respond just now. Please try again in a moment.";
  let sawNonExhaustionFailure = false;

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

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
        // Real upstream status/body, logged server-side only — never sent
        // to the browser, and the model name never leaves this function.
        console.error("OpenRouter error", model, res.status, errText);
        lastMessage = studentSafeMessage(res.status);
        if (!EXHAUSTION_STATUSES.has(res.status)) sawNonExhaustionFailure = true;
        if (RETRYABLE_STATUSES.has(res.status)) continue; // try the next model
        break; // not a "try another model" situation (e.g. bad request)
      }

      const data = await res.json();
      const reply: string | undefined = data?.choices?.[0]?.message?.content;
      if (!reply) {
        lastMessage = "The AI Tutor didn't return a response.";
        sawNonExhaustionFailure = true;
        continue;
      }

      // Model identity is intentionally stripped from the response before
      // it ever leaves the server.
      return NextResponse.json({ reply, elapsedMs: Date.now() - startedAt });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      console.error("Tutor route model failure", model, timedOut ? "timeout" : err);
      lastMessage = timedOut ? "The AI Tutor took too long to respond." : "Something went wrong reaching the AI Tutor.";
      sawNonExhaustionFailure = true;
      continue;
    }
  }

  // Every model in the list failed. If none of those failures were "real"
  // errors (bad key, bad request, etc) — i.e. they were all credit/rate
  // exhaustion — tell the client it's safe to fall back to the on-device
  // tutor. If something more fundamental is wrong, surface that instead so
  // it doesn't get masked by a silent fallback every single time.
  return NextResponse.json(
    { error: lastMessage, allExhausted: !sawNonExhaustionFailure },
    { status: 502 }
  );
}
