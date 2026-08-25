"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Sparkles, FileText, Globe, Laptop, Clock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore, SUBJECT_LIBRARY } from "@/lib/store";
import { Button, Card, Pill } from "@/components/ui";
import type { AIMessage } from "@/lib/types";
import { retrieveContext } from "@/lib/ai/retrieval";
import { answerLocally, checkWebLLMAvailability, type WebLLMLoadProgress } from "@/lib/ai/webllm";

function TutorChat() {
  const { ready, profile } = useRequireProfile();
  const params = useSearchParams();
  const subjectId = params.get("subject") || undefined;
  const subjects = useStore((s) => s.subjects);
  const notes = useStore((s) => s.notes);
  const weaknesses = useStore((s) => s.weaknesses);
  const addConversation = useStore((s) => s.addConversation);
  const appendMessage = useStore((s) => s.appendMessage);
  const conversations = useStore((s) => s.conversations);

  const subject = subjects.find((s) => s.id === subjectId);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadStage, setLoadStage] = useState<string | null>(null); // e.g. "Downloading local model…"
  const [error, setError] = useState<string | null>(null);
  const [webLLMSupported, setWebLLMSupported] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWebLLMSupported(checkWebLLMAvailability().supported);
  }, []);

  const conversation = conversations.find((c) => c.id === conversationId);
  const messages = conversation?.messages ?? [];

  async function runLocalTutor(
    systemContext: Parameters<typeof buildSystemContextString>[0],
    history: AIMessage[]
  ): Promise<{ reply: string; elapsedMs: number } | null> {
    const availability = checkWebLLMAvailability();
    if (!availability.supported) return null;

    const onProgress = (p: WebLLMLoadProgress) => {
      setLoadStage(p.progress < 1 ? "Loading the on-device tutor…" : "Almost ready…");
    };
    try {
      const result = await answerLocally(
        buildSystemContextString(systemContext),
        history.map((m) => ({ role: m.role, content: m.content })),
        onProgress
      );
      return result;
    } catch (err) {
      console.error("Local tutor failed", err);
      return null;
    } finally {
      setLoadStage(null);
    }
  }

  async function send() {
    if (!input.trim() || loading || !profile) return;
    const question = input.trim();
    setInput("");
    setError(null);

    let convoId = conversationId;
    if (!convoId) {
      convoId = addConversation({ subjectId, topic: subject?.name, messages: [] });
      setConversationId(convoId);
    }
    const studentMsg: AIMessage = { id: `${Date.now()}`, role: "student", content: question, createdAt: new Date().toISOString() };
    appendMessage(convoId, studentMsg);

    const excerpts = await retrieveContext(question, notes, subjectId);
    const activeWeaknesses = weaknesses.filter((w) => (subjectId ? w.subjectId === subjectId : true) && w.status !== "resolved").map((w) => w.topicName);
    const usedSources = excerpts.map((e) => ({ title: e.title, type: e.source }));

    const systemContext = {
      studentName: profile.name,
      educationLevel: profile.educationLevel,
      examBoard: profile.examBoard,
      subjectName: subject?.name,
      recentWeaknesses: activeWeaknesses,
      noteExcerpts: excerpts.map((e) => ({ title: e.title, excerpt: e.excerpt })),
    };
    const history = [...messages, studentMsg];
    const startedAt = Date.now();

    setLoading(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          context: systemContext,
        }),
      });
      const data = await res.json();

      if (res.ok && data.reply) {
        appendMessage(convoId, {
          id: `${Date.now()}-r`,
          role: "tutor",
          content: data.reply,
          usedSources,
          createdAt: new Date().toISOString(),
          elapsedMs: data.elapsedMs ?? Date.now() - startedAt,
          answeredBy: "cloud",
        });
        return;
      }

      // Cloud tutor failed. If it signalled exhaustion (every configured
      // model out of credit/rate-limited, or no key at all), fall back to
      // the on-device tutor automatically rather than showing an error.
      if (data.allExhausted) {
        const local = await runLocalTutor(systemContext, history);
        if (local) {
          appendMessage(convoId, {
            id: `${Date.now()}-r`,
            role: "tutor",
            content: local.reply,
            usedSources,
            createdAt: new Date().toISOString(),
            elapsedMs: local.elapsedMs,
            answeredBy: "local",
          });
          return;
        }
        setError(
          webLLMSupported === false
            ? "The AI Tutor is temporarily unavailable and this browser/device doesn't support the on-device fallback (WebGPU isn't available). Try a recent version of Chrome or Edge, or try again later."
            : "The AI Tutor is temporarily unavailable and the on-device fallback couldn't start. Please try again."
        );
        return;
      }

      throw new Error(data.error || "The AI Tutor couldn't respond.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    }
  }

  if (!ready || !profile) return null;

  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100vh-56px)] max-w-3xl flex-col px-6 py-6 md:h-screen">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-[var(--color-primary)]" />
          <h1 className="font-display text-2xl font-semibold">AI Tutor{subject ? ` · ${subject.name}` : ""}</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Asks what it doesn't know, teaches with hints before answers, and tells you when it's used something
          outside your notes and resources.
        </p>

        <div ref={scrollRef} className="thin-scroll mt-4 flex-1 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <Card className="mt-4">
              <p className="text-sm text-[var(--color-ink-soft)]">
                Try: “Can you help me understand {subject ? SUBJECT_LIBRARY[subject.id]?.strands[0] : "a topic I'm stuck on"}?”
              </p>
            </Card>
          )}
          <div className="flex flex-col gap-4 py-2">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "student" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                    m.role === "student" ? "bg-[var(--color-primary)] text-white" : "card-surface"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.role === "tutor" && (m.usedSources?.length || m.elapsedMs !== undefined || m.answeredBy === "local") && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {m.usedSources?.map((s, i) => (
                        <Pill key={i} tone="primary">
                          {s.type === "note" ? <FileText size={11} /> : s.type === "resource" ? <FileText size={11} /> : <Globe size={11} />}{" "}
                          {s.title}
                        </Pill>
                      ))}
                      {m.answeredBy === "local" && (
                        <Pill tone="amber">
                          <Laptop size={11} /> On-device
                        </Pill>
                      )}
                      {m.elapsedMs !== undefined && (
                        <Pill tone="neutral">
                          <Clock size={11} /> {(m.elapsedMs / 1000).toFixed(1)}s
                        </Pill>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && <p className="text-sm text-[var(--color-ink-faint)]">{loadStage ?? "Thinking…"}</p>}
            {error && <p className="text-sm text-[var(--color-flag)]">{error}</p>}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-line)] pt-3">
          <input
            className="input flex-1"
            placeholder="Ask about anything you're studying…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <Button onClick={send} disabled={loading || !input.trim()}>
            <Send size={16} />
          </Button>
        </div>
      </div>

      <style jsx global>{`
        .input {
          border: 1px solid var(--color-line);
          border-radius: 999px;
          padding: 10px 16px;
          background: white;
          font-size: 14.5px;
        }
        .input:focus {
          outline: 2px solid var(--color-primary);
          outline-offset: 1px;
        }
      `}</style>
    </AppShell>
  );
}

interface SystemContext {
  studentName?: string;
  educationLevel?: string;
  examBoard?: string;
  subjectName?: string;
  recentWeaknesses?: string[];
  noteExcerpts?: { title: string; excerpt: string }[];
}

// Mirrors the server's system prompt (app/api/tutor/route.ts) so the local
// WebLLM tutor follows the same ground rules and grounding behaviour as
// the cloud tutor — same "don't invent, say when it's not in the
// student's materials" instructions either way.
function buildSystemContextString(ctx: SystemContext): string {
  return `You are the AI Tutor inside MAAR Study Hub, running locally on this device. You are a teaching assistant, not a replacement for a real teacher.

Ground rules:
- Teach, don't just answer. Guide with hints before revealing full solutions.
- Prefer the student's own notes/resources (given below) over general knowledge when relevant. Say plainly when you're using outside knowledge.
- Never invent facts, sources, or marks. If the answer isn't in the student's materials, say so directly instead of guessing.
- Be encouraging and specific.
- Keep the answer short — a maximum of about 20 lines.

Student context:
- Name: ${ctx.studentName ?? "unknown"}
- Level: ${ctx.educationLevel ?? "unspecified"}${ctx.examBoard ? `, exam board: ${ctx.examBoard}` : ""}
- Subject: ${ctx.subjectName ?? "general"}
- Recent weak areas: ${ctx.recentWeaknesses?.length ? ctx.recentWeaknesses.join(", ") : "none on record"}
${ctx.noteExcerpts?.length ? `\nRelevant excerpts from the student's own materials:\n${ctx.noteExcerpts.map((n) => `[${n.title}]\n${n.excerpt}`).join("\n\n")}` : "\nNo matching material was found in the student's notes or resources for this question — say so if it depends on their specific course content."}
`;
}

export default function TutorPage() {
  return (
    <Suspense fallback={null}>
      <TutorChat />
    </Suspense>
  );
}
