"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore } from "@/lib/store";
import { Button, Card } from "@/components/ui";
import type { LearningPreferenceSignal } from "@/lib/types";

const PREFS: LearningPreferenceSignal["type"][] = ["visual", "reading-writing", "examples", "practice", "diagrams", "step-by-step"];
const PREF_LABEL: Record<string, string> = {
  visual: "Visual explanations",
  "reading-writing": "Reading & writing",
  examples: "Worked examples",
  practice: "Practice questions",
  diagrams: "Diagrams",
  "step-by-step": "Step-by-step breakdowns",
};

export default function SettingsPage() {
  const { ready, profile } = useRequireProfile();
  const setLearningPreferences = useStore((s) => s.setLearningPreferences);
  const resetAll = useStore((s) => s.resetAll);
  const router = useRouter();
  const [allowExternal, setAllowExternal] = useState(true);
  const [selected, setSelected] = useState<string[]>(profile?.learningPreferences.map((p) => p.type) ?? []);

  if (!ready || !profile) return null;

  function toggle(t: string) {
    setSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function save() {
    setLearningPreferences(selected.map((type) => ({ type: type as LearningPreferenceSignal["type"], strength: 0.6 })));
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="font-display text-3xl font-semibold">Settings</h1>

        <Card className="mt-6">
          <h2 className="font-semibold">Profile</h2>
          <div className="mt-3 flex flex-col gap-1 text-sm text-[var(--color-ink-soft)]">
            <p>Name: {profile.name}</p>
            <p>Level: {profile.educationLevel} · {profile.yearOrGroup}</p>
            {profile.schoolOrCollege && <p>School/college: {profile.schoolOrCollege}</p>}
            {profile.examBoard && <p>Exam board: {profile.examBoard}</p>}
          </div>
        </Card>

        <Card className="mt-4">
          <h2 className="font-semibold">Learning preferences</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            These are signals, not a fixed label — MAAR combines them with what actually helps you improve.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PREFS.map((p) => (
              <button
                key={p}
                onClick={() => toggle(p)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                  selected.includes(p) ? "border-[var(--color-primary)] bg-[var(--color-primary-dim)] text-[var(--color-primary)]" : "border-[var(--color-line)]"
                }`}
              >
                {PREF_LABEL[p]}
              </button>
            ))}
          </div>
          <Button size="sm" className="mt-4" onClick={save}>
            Save preferences
          </Button>
        </Card>

        <Card className="mt-4">
          <h2 className="font-semibold">AI Tutor settings</h2>
          <label className="mt-3 flex items-center justify-between">
            <span className="text-sm text-[var(--color-ink-soft)]">Allow the tutor to use general knowledge beyond my notes (always clearly labelled)</span>
            <input type="checkbox" checked={allowExternal} onChange={(e) => setAllowExternal(e.target.checked)} className="h-4 w-4" />
          </label>
        </Card>

        <Card className="mt-4 border-[var(--color-flag)]/30">
          <h2 className="font-semibold">Data &amp; account</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            This demo build stores everything only in your browser. Deleting your account removes it from here.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3 border-[var(--color-flag)] text-[var(--color-flag)]"
            onClick={() => {
              if (confirm("Delete your account and all local data? This can't be undone.")) {
                resetAll();
                router.push("/");
              }
            }}
          >
            <Trash2 size={14} /> Delete account &amp; data
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
