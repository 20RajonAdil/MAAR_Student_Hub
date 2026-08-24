"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore } from "@/lib/store";
import { Button, Card, Pill } from "@/components/ui";
import { icon } from "@/components/subjectIcon";
import { MiniQuiz } from "@/components/MiniQuiz";
import { getQuestionsForTopic } from "@/lib/diagnostics";
import type { SubjectId } from "@/lib/types";

const TABS = ["Overview", "Notes", "Practice", "Weaknesses", "Error Journal", "Progress"] as const;
type Tab = (typeof TABS)[number];

export default function SubjectWorkspace({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = use(params);
  const { ready, profile } = useRequireProfile();
  const subjects = useStore((s) => s.subjects);
  const subject = subjects.find((s) => s.id === subjectId);
  const [tab, setTab] = useState<Tab>("Overview");

  if (!ready || !profile) return null;
  if (!subject) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="text-[var(--color-ink-soft)]">This subject isn't active yet.</p>
          <Link href="/subjects" className="mt-4 inline-block">
            <Button variant="secondary">Back to subjects</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const Icon = icon(subject.icon);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${subject.color} 15%, white)` }}>
              <Icon size={22} style={{ color: subject.color }} />
            </div>
            <h1 className="font-display text-3xl font-semibold">{subject.name}</h1>
          </div>
          <Link href={`/tutor?subject=${subject.id}`}>
            <Button size="sm">
              <MessageCircle size={16} /> Ask AI Tutor
            </Button>
          </Link>
        </div>

        <div className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--color-line)]">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                tab === t ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-transparent text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "Overview" && <OverviewTab subjectId={subject.id} />}
          {tab === "Notes" && <NotesTab subjectId={subject.id} />}
          {tab === "Practice" && <PracticeTab subjectId={subject.id} />}
          {tab === "Weaknesses" && <WeaknessesTab subjectId={subject.id} />}
          {tab === "Error Journal" && <ErrorJournalTab subjectId={subject.id} />}
          {tab === "Progress" && <ProgressTab subjectId={subject.id} />}
        </div>
      </div>
    </AppShell>
  );
}

const STATUS_LABEL: Record<string, string> = {
  "not-started": "Not started",
  learning: "Learning",
  practising: "Practising",
  developing: "Developing",
  "ready-for-verification": "Ready to verify",
  mastered: "Mastered",
  "needs-review": "Needs review",
};

function OverviewTab({ subjectId }: { subjectId: SubjectId }) {
  const subject = useStore((s) => s.subjects.find((x) => x.id === subjectId))!;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {subject.topics.map((t) => (
        <Card key={t.id} className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t.name}</p>
            <Pill tone={t.status === "mastered" ? "primary" : t.status === "not-started" ? "neutral" : "amber"}>
              {STATUS_LABEL[t.status]}
            </Pill>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full" style={{ width: `${t.masteryScore}%`, background: subject.color }} />
          </div>
          <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">{t.masteryScore}% mastery · {t.evidenceCount} pieces of evidence</p>
        </Card>
      ))}
    </div>
  );
}

function NotesTab({ subjectId }: { subjectId: SubjectId }) {
  const notes = useStore((s) => s.notes.filter((n) => n.subjectId === subjectId));
  const upsertNote = useStore((s) => s.upsertNote);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = notes.find((n) => n.id === activeId);

  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr]">
      <div>
        <Button
          size="sm"
          className="mb-3 w-full"
          onClick={() => {
            const n = upsertNote({ subjectId, title: "Untitled note", contentHtml: "" });
            setActiveId(n.id);
          }}
        >
          + New note
        </Button>
        <ul className="flex flex-col gap-1">
          {notes.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => setActiveId(n.id)}
                className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${activeId === n.id ? "bg-[var(--color-primary-dim)] text-[var(--color-primary)]" : "hover:bg-black/5"}`}
              >
                {n.title || "Untitled note"}
              </button>
            </li>
          ))}
          {notes.length === 0 && <p className="px-1 text-xs text-[var(--color-ink-faint)]">No notes yet — start one to see it appear here.</p>}
        </ul>
      </div>
      <Card>
        {active ? (
          <div>
            <input
              className="w-full border-none bg-transparent font-display text-xl font-semibold outline-none"
              value={active.title}
              onChange={(e) => upsertNote({ id: active.id, subjectId, title: e.target.value })}
              placeholder="Lesson title"
            />
            <p className="mb-3 text-xs text-[var(--color-ink-faint)]">Autosaves as you type · last updated {new Date(active.updatedAt).toLocaleString("en-GB")}</p>
            <div
              contentEditable
              suppressContentEditableWarning
              className="thin-scroll min-h-[300px] rounded-xl border border-[var(--color-line)] p-4 text-[15px] leading-relaxed outline-none"
              onBlur={(e) => upsertNote({ id: active.id, subjectId, contentHtml: e.currentTarget.innerHTML })}
              dangerouslySetInnerHTML={{ __html: active.contentHtml }}
            />
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-[var(--color-ink-faint)]">Select or create a note to start writing.</p>
        )}
      </Card>
    </div>
  );
}

function PracticeTab({ subjectId }: { subjectId: SubjectId }) {
  const subject = useStore((s) => s.subjects.find((x) => x.id === subjectId))!;
  const profile = useStore((s) => s.profile);
  const updateTopicMastery = useStore((s) => s.updateTopicMastery);
  const logActivity = useStore((s) => s.logActivity);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const activeTopic = subject.topics.find((t) => t.id === activeTopicId);

  const questions = useMemo(
    () => (activeTopic ? getQuestionsForTopic(subjectId, activeTopic.name, profile?.educationLevel ?? "gcse") : []),
    [activeTopic, subjectId, profile]
  );

  if (activeTopic) {
    return (
      <Card className="mx-auto max-w-md">
        <Pill tone="primary">{activeTopic.name}</Pill>
        <div className="mt-4">
          <MiniQuiz
            questions={questions}
            onComplete={({ correct, total }) => {
              updateTopicMastery(activeTopic.id, Math.round((correct / total) * 20), "practising");
              logActivity({ label: `Practised ${activeTopic.name}`, subjectId, kind: "practice" });
              setActiveTopicId(null);
            }}
          />
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {subject.topics.map((t) => (
        <button key={t.id} onClick={() => setActiveTopicId(t.id)} className="text-left">
          <Card className="h-full transition-shadow hover:shadow-md">
            <p className="text-sm font-medium">{t.name}</p>
            <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{t.masteryScore}% mastery — practise to strengthen it</p>
          </Card>
        </button>
      ))}
    </div>
  );
}

function WeaknessesTab({ subjectId }: { subjectId: SubjectId }) {
  const subject = useStore((s) => s.subjects.find((x) => x.id === subjectId))!;
  const profile = useStore((s) => s.profile);
  const weaknesses = useStore((s) => s.weaknesses.filter((w) => w.subjectId === subjectId));
  const requestVerification = useStore((s) => s.requestVerification);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const verifying = weaknesses.find((w) => w.id === verifyingId);

  if (verifying) {
    const questions = getQuestionsForTopic(subjectId, verifying.topicName, profile?.educationLevel ?? "gcse");
    return (
      <Card className="mx-auto max-w-md">
        <Pill tone="amber">
          <Sparkles size={13} /> Prove it: {verifying.topicName}
        </Pill>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          Answer these to show you've got this. If it doesn't quite land yet, that's completely fine — we'll keep it
          as a goal and suggest what to try next.
        </p>
        <div className="mt-4">
          <MiniQuiz
            questions={questions}
            onComplete={({ passed }) => {
              requestVerification(verifying.id, passed);
              setVerifyingId(null);
            }}
          />
        </div>
      </Card>
    );
  }

  if (weaknesses.filter((w) => w.status !== "resolved").length === 0) {
    return <p className="text-sm text-[var(--color-ink-soft)]">No active weaknesses in {subject.name} right now — nice and steady.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {weaknesses
        .filter((w) => w.status !== "resolved")
        .map((w) => (
          <Card key={w.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{w.topicName}</p>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{w.reason}</p>
                {w.isInference && <Pill tone="amber" className="mt-2">Possible pattern from your notes — not confirmed yet</Pill>}
                <ul className="mt-2 flex flex-col gap-0.5">
                  {w.recentEvidence.map((e, i) => (
                    <li key={i} className="text-xs text-[var(--color-ink-faint)]">• {e}</li>
                  ))}
                </ul>
              </div>
              <Button size="sm" variant="amber" onClick={() => setVerifyingId(w.id)}>
                I'm ready to prove it
              </Button>
            </div>
          </Card>
        ))}
    </div>
  );
}

function ErrorJournalTab({ subjectId }: { subjectId: SubjectId }) {
  const entries = useStore((s) => s.errorJournal.filter((e) => e.subjectId === subjectId));
  if (entries.length === 0) {
    return <p className="text-sm text-[var(--color-ink-soft)]">Mistake patterns will appear here as you practise — this is for learning, not for keeping score.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {entries.map((e) => (
        <Card key={e.id}>
          <Pill tone="flag">{e.pattern.replace(/-/g, " ")}</Pill>
          <p className="mt-2 text-sm">{e.whatHappened}</p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Why: {e.whyItMayHaveHappened}</p>
          <p className="mt-1 text-sm text-[var(--color-primary)]">Next time: {e.howToAvoid}</p>
        </Card>
      ))}
    </div>
  );
}

function ProgressTab({ subjectId }: { subjectId: SubjectId }) {
  const subject = useStore((s) => s.subjects.find((x) => x.id === subjectId))!;
  return (
    <div className="flex flex-col gap-3">
      {subject.topics
        .slice()
        .sort((a, b) => b.masteryScore - a.masteryScore)
        .map((t) => (
          <div key={t.id} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-sm">{t.name}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
              <div className="h-full rounded-full" style={{ width: `${t.masteryScore}%`, background: subject.color }} />
            </div>
            <span className="font-mono w-10 shrink-0 text-right text-xs text-[var(--color-ink-faint)]">{t.masteryScore}%</span>
          </div>
        ))}
    </div>
  );
}
