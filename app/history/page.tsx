"use client";

import { useState } from "react";
import Link from "next/link";
import { History, MessagesSquare, ChevronDown, ChevronRight, FileText, Globe, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore, SUBJECT_LIBRARY } from "@/lib/store";
import { Card, Pill } from "@/components/ui";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatHistoryPage() {
  const { ready, profile } = useRequireProfile();
  const conversations = useStore((s) => s.conversations);
  const [openId, setOpenId] = useState<string | null>(null);

  if (!ready || !profile) return null;

  // Newest first — this list only ever grows. Nothing in the app deletes
  // from `conversations`, including the "reset my data" action in Settings.
  const sorted = [...conversations].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-6">
        <div className="flex items-center gap-2">
          <History size={18} className="text-[var(--color-primary)]" />
          <h1 className="font-display text-2xl font-semibold">Chat History</h1>
        </div>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-[var(--color-ink-soft)]">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
          Every AI Tutor conversation you&apos;ve ever had is kept here permanently — nothing here is ever
          auto-deleted, and even resetting your account data in Settings leaves this untouched.
        </p>

        {sorted.length === 0 ? (
          <Card className="mt-6">
            <p className="text-sm text-[var(--color-ink-soft)]">
              No conversations yet. Head to the{" "}
              <Link href="/tutor" className="font-medium text-[var(--color-primary)] underline">
                AI Tutor
              </Link>{" "}
              to start one — it&apos;ll show up here automatically.
            </p>
          </Card>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {sorted.map((c) => {
              const open = openId === c.id;
              const subjectName = c.subjectId ? SUBJECT_LIBRARY[c.subjectId]?.name ?? c.subjectId : null;
              const preview = c.messages[0]?.content?.slice(0, 90) ?? "(no messages)";
              return (
                <Card key={c.id} className="p-0 overflow-hidden">
                  <button
                    className="flex w-full items-start gap-3 px-5 py-4 text-left"
                    onClick={() => setOpenId(open ? null : c.id)}
                  >
                    <MessagesSquare size={16} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{c.topic || subjectName || "General conversation"}</p>
                        {subjectName && c.topic && <Pill tone="primary">{subjectName}</Pill>}
                        <Pill>{c.messages.length} message{c.messages.length === 1 ? "" : "s"}</Pill>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-[var(--color-ink-soft)]">{preview}</p>
                      <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
                        Started {formatDate(c.createdAt)} · Last message {formatDate(c.updatedAt)}
                      </p>
                    </div>
                    {open ? (
                      <ChevronDown size={18} className="mt-0.5 shrink-0 text-[var(--color-ink-faint)]" />
                    ) : (
                      <ChevronRight size={18} className="mt-0.5 shrink-0 text-[var(--color-ink-faint)]" />
                    )}
                  </button>

                  {open && (
                    <div className="thin-scroll max-h-[420px] overflow-y-auto border-t border-[var(--color-line)] bg-black/[0.015] px-5 py-4">
                      <div className="flex flex-col gap-3">
                        {c.messages.map((m) => (
                          <div key={m.id} className={`flex ${m.role === "student" ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
                              <p
                                className={`mt-1 text-[10.5px] ${
                                  m.role === "student" ? "text-white/70" : "text-[var(--color-ink-faint)]"
                                }`}
                              >
                                {formatDate(m.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
