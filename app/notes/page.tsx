"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore } from "@/lib/store";
import { Button, Card } from "@/components/ui";
import { RichEditor } from "@/components/RichEditor";

export default function NotesPage() {
  const { ready } = useRequireProfile();
  const subjects = useStore((s) => s.subjects);
  const notes = useStore((s) => s.notes);
  const upsertNote = useStore((s) => s.upsertNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!ready) return null;
  const active = notes.find((n) => n.id === activeId);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="font-display text-3xl font-semibold">Notes</h1>
        <p className="mt-1 text-[var(--color-ink-soft)]">Organised by subject, autosaved as you write.</p>

        <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr]">
          <div className="flex flex-col gap-4">
            {subjects.map((subject) => {
              const subjectNotes = notes.filter((n) => n.subjectId === subject.id);
              const isOpen = expanded[subject.id] ?? true;
              const shown = isOpen ? subjectNotes : subjectNotes.slice(0, 3);
              return (
                <div key={subject.id}>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-medium tracking-wide text-[var(--color-ink-faint)] uppercase">{subject.name}</p>
                    <button
                      className="text-xs text-[var(--color-primary)]"
                      onClick={() => upsertNote({ subjectId: subject.id, title: "Untitled note", contentHtml: "" })}
                    >
                      + New
                    </button>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {shown.map((n) => (
                      <li key={n.id}>
                        <button
                          onClick={() => setActiveId(n.id)}
                          className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${activeId === n.id ? "bg-[var(--color-primary-dim)] text-[var(--color-primary)]" : "hover:bg-black/5"}`}
                        >
                          {n.title || "Untitled note"}
                        </button>
                      </li>
                    ))}
                    {subjectNotes.length === 0 && <li className="px-1 text-xs text-[var(--color-ink-faint)]">No notes yet.</li>}
                  </ul>
                  {subjectNotes.length > 3 && (
                    <button className="mt-1 text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]" onClick={() => setExpanded((e) => ({ ...e, [subject.id]: !isOpen }))}>
                      {isOpen ? "Show less" : `Show ${subjectNotes.length - 3} more`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <Card>
            {active ? (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <input
                    className="w-full border-none bg-transparent font-display text-xl font-semibold outline-none"
                    value={active.title}
                    onChange={(e) => upsertNote({ id: active.id, subjectId: active.subjectId, title: e.target.value })}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      deleteNote(active.id);
                      setActiveId(null);
                    }}
                  >
                    Delete
                  </Button>
                </div>
                <p className="mb-3 text-xs text-[var(--color-ink-faint)]">Autosaves as you type · last updated {new Date(active.updatedAt).toLocaleString("en-GB")}</p>
                <RichEditor
                  html={active.contentHtml}
                  onChange={(contentHtml) => upsertNote({ id: active.id, subjectId: active.subjectId, contentHtml })}
                  placeholder="Start writing…"
                  minHeight={400}
                />
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-[var(--color-ink-faint)]">Select a note, or start a new one from a subject on the left.</p>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
