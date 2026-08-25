import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────
// AI Tutor endpoint. Runs server-side only:
//  - the OpenRouter API key never reaches the browser
//  - the underlying model name never reaches the browser (or the student)
//  - only the context the request actually needs is forwarded to the model
//
// Set OPENROUTER_API_KEY in your environment (.env.local locally, or your
// host's secrets manager in production). Never commit the key.
// ─────────────────────────────────────────────────────────────────────────

// The one model MAAR Study Hub uses for tutoring. Kept server-side only —
// swap this single line if you want to change models; nothing in the UI
// references it.
const STUDY_MODEL = process.env.MAAR_TUTOR_MODEL || "anthropic/claude-sonnet-4.5";

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

  const openRouterMessages = [
    { role: "system", content: SYSTEM_PROMPT(body.context ?? {}) },
    ...body.messages.map((m) => ({
      role: m.role === "student" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
  ];

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // OpenRouter asks apps to identify themselves — this is not the model name.
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://maar-student-hub.vercel.app",
        "X-Title": "MAAR Study Hub",
      },
      body: JSON.stringify({
        model: STUDY_MODEL,
        messages: openRouterMessages,
        temperature: 0.4,
        max_tokens: 900,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenRouter error", res.status, errText);
      return NextResponse.json(
        { error: "The AI Tutor couldn't respond just now. Please try again in a moment." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const reply: string | undefined = data?.choices?.[0]?.message?.content;
    if (!reply) {
      return NextResponse.json({ error: "The AI Tutor didn't return a response. Please try again." }, { status: 502 });
    }

    // Model identity is intentionally stripped from the response before it
    // ever leaves the server.
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Tutor route failure", err);
    return NextResponse.json({ error: "Something went wrong reaching the AI Tutor." }, { status: 500 });
  }
}
