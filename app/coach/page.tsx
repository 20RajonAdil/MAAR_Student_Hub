"use client";

import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore } from "@/lib/store";
import { Button, Card, Pill } from "@/components/ui";

const TECHNIQUES = [
  { id: "focus-block", label: "Focus block", minutes: 25, note: "~25 min work, then a short break — good default for most tasks." },
  { id: "active-recall", label: "Active recall", minutes: 20, note: "Test yourself from memory before checking notes." },
  { id: "spaced-repetition", label: "Spaced repetition", minutes: 15, note: "Revisit something you learned a few days ago." },
  { id: "interleaving", label: "Interleaving", minutes: 30, note: "Mix two related topics instead of drilling one." },
] as const;

export default function CoachPage() {
  const { ready } = useRequireProfile();
  const subjects = useStore((s) => s.subjects);
  const startSession = useStore((s) => s.startSession);
  const endSession = useStore((s) => s.endSession);

  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [technique, setTechnique] = useState<(typeof TECHNIQUES)[number]>(TECHNIQUES[0]);
  const [phase, setPhase] = useState<"setup" | "running" | "reflect">("setup");
  const [secondsLeft, setSecondsLeft] = useState(technique.minutes * 60);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [completedTask, setCompletedTask] = useState("");
  const [retrievalAnswer, setRetrievalAnswer] = useState("");

  useEffect(() => {
    if (!running) return;
    if (secondsLeft <= 0) {
      setRunning(false);
      setPhase("reflect");
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [running, secondsLeft]);

  if (!ready) return null;

  function begin() {
    const id = startSession({ subjectId: subjectId ?? subjects[0]?.id ?? "maths", technique: technique.id, plannedMinutes: technique.minutes });
    setSessionId(id);
    setSecondsLeft(technique.minutes * 60);
    setPhase("running");
    setRunning(true);
  }

  function finish() {
    if (sessionId) {
      endSession(sessionId, {
        actualMinutes: technique.minutes - Math.floor(secondsLeft / 60),
        completedTask,
        retrievalCheckPassed: retrievalAnswer.trim().length > 0,
      });
    }
    setPhase("setup");
    setSessionId(null);
    setCompletedTask("");
    setRetrievalAnswer("");
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="font-display text-3xl font-semibold">Study Coach</h1>
        <p className="mt-1 text-[var(--color-ink-soft)]">Evidence-based techniques, distraction-free — not a race against a leaderboard.</p>

        {phase === "setup" && (
          <Card className="mt-6">
            <p className="mb-2 text-xs font-medium tracking-wide text-[var(--color-ink-faint)] uppercase">Subject</p>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSubjectId(s.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                    (subjectId ?? subjects[0]?.id) === s.id ? "border-[var(--color-primary)] bg-[var(--color-primary-dim)] text-[var(--color-primary)]" : "border-[var(--color-line)]"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <p className="mt-5 mb-2 text-xs font-medium tracking-wide text-[var(--color-ink-faint)] uppercase">Technique</p>
            <div className="flex flex-col gap-2">
              {TECHNIQUES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTechnique(t);
                    setSecondsLeft(t.minutes * 60);
                  }}
                  className={`rounded-xl border p-3 text-left ${technique.id === t.id ? "border-[var(--color-primary)] bg-[var(--color-primary-dim)]" : "border-[var(--color-line)]"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t.label}</span>
                    <Pill tone="neutral">{t.minutes} min</Pill>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{t.note}</p>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--color-ink-faint)]">These durations are a configurable starting point, not a rule.</p>
            <Button className="mt-5 w-full" size="lg" onClick={begin} disabled={subjects.length === 0}>
              Start session
            </Button>
          </Card>
        )}

        {phase === "running" && (
          <Card className="mt-6 flex flex-col items-center py-12 text-center">
            <p className="text-sm text-[var(--color-ink-faint)]">{technique.label} · {(subjects.find((s) => s.id === subjectId) ?? subjects[0])?.name}</p>
            <p className="font-mono mt-4 text-6xl font-semibold">{mm}:{ss}</p>
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={() => setRunning((r) => !r)}>
                {running ? <Pause size={18} /> : <Play size={18} />}
              </Button>
              <Button variant="ghost" onClick={() => setSecondsLeft(technique.minutes * 60)}>
                <RotateCcw size={18} />
              </Button>
            </div>
            <button className="mt-8 text-sm text-[var(--color-ink-faint)] underline" onClick={() => setPhase("reflect")}>
              End early
            </button>
          </Card>
        )}

        {phase === "reflect" && (
          <Card className="mt-6">
            <h2 className="font-semibold">Quick reflection</h2>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--color-ink-faint)] uppercase">What did you work on?</span>
              <input className="w-full rounded-xl border border-[var(--color-line)] px-3.5 py-2.5 text-sm" value={completedTask} onChange={(e) => setCompletedTask(e.target.value)} placeholder="e.g. Practised solving linear equations" />
            </label>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--color-ink-faint)] uppercase">Quick retrieval check — write one thing you now remember, without looking back</span>
              <textarea className="w-full rounded-xl border border-[var(--color-line)] px-3.5 py-2.5 text-sm" rows={3} value={retrievalAnswer} onChange={(e) => setRetrievalAnswer(e.target.value)} />
            </label>
            <Button className="mt-5 w-full" size="lg" onClick={finish}>
              Save session
            </Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
