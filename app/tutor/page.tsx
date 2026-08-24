"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Sparkles, FileText, Globe } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore, SUBJECT_LIBRARY } from "@/lib/store";
import { Button, Card, Pill } from "@/components/ui";
import type { AIMessage } from "@/lib/types";

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
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((c) => c.id === conversationId);
  const messages = conversation?.messages ?? [];

  // Very simple client-side "retrieval": keyword-overlap match against the
  // student's own notes for this subject, so the tutor prefers real
  // uploaded/written material over general knowledge.
  function relevantNoteExcerpts(question: string) {
    const words = question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    return notes
      .filter((n) => (subjectId ? n.subjectId === subjectId : true))
      .map((n) => {
        const text = n.contentHtml.replace(/<[^>]+>/g, " ");
        const hits = words.filter((w) => text.toLowerCase().includes(w)).length;
        return { note: n, hits, text };
      })
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 2)
      .map((x) => ({ title: x.note.title, excerpt: x.text.slice(0, 400) }));
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

    const noteExcerpts = relevantNoteExcerpts(question);
    const activeWeaknesses = weaknesses.filter((w) => (subjectId ? w.subjectId === subjectId : true) && w.status !== "resolved").map((w) => w.topicName);

    setLoading(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, studentMsg].map((m) => ({ role: m.role, content: m.content })),
          context: {
            studentName: profile.name,
            educationLevel: profile.educationLevel,
            examBoard: profile.examBoard,
            subjectName: subject?.name,
            recentWeaknesses: activeWeaknesses,
            noteExcerpts,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The AI Tutor couldn't respond.");
      appendMessage(convoId, {
        id: `${Date.now()}-r`,
        role: "tutor",
        content: data.reply,
        usedSources: noteExcerpts.map((n) => ({ title: n.title, type: "note" as const })),
        createdAt: new Date().toISOString(),
      });
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
          outside your notes.
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
                  {m.usedSources && m.usedSources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.usedSources.map((s, i) => (
                        <Pill key={i} tone="primary">
                          {s.type === "note" ? <FileText size={11} /> : <Globe size={11} />} {s.title}
                        </Pill>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && <p className="text-sm text-[var(--color-ink-faint)]">Thinking…</p>}
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

export default function TutorPage() {
  return (
    <Suspense fallback={null}>
      <TutorChat />
    </Suspense>
  );
}
