"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Trash2, FolderKey, Download, Upload, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore } from "@/lib/store";
import { Button, Card } from "@/components/ui";
import type { LearningPreferenceSignal } from "@/lib/types";

const STORAGE_KEY = "maar-study-hub-demo-store";
const DATA_FILE_NAME = "MAAR-Student-Hub-Data-Center.maar";

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
  const [restoreMessage, setRestoreMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!ready || !profile) return null;

  function toggle(t: string) {
    setSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function save() {
    setLearningPreferences(selected.map((type) => ({ type: type as LearningPreferenceSignal["type"], strength: 0.6 })));
  }

  function downloadDataFile() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = DATA_FILE_NAME;
    a.click();
    URL.revokeObjectURL(url);
  }

  function restoreFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        JSON.parse(text); // validate it's real MAAR data before touching storage
        localStorage.setItem(STORAGE_KEY, text);
        setRestoreMessage({ tone: "ok", text: "Data restored — reloading…" });
        setTimeout(() => window.location.reload(), 900);
      } catch {
        setRestoreMessage({ tone: "error", text: "That doesn't look like a MAAR Student Hub data file." });
      }
    };
    reader.readAsText(file);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="font-display text-3xl font-semibold">Settings</h1>

        <Card className="mt-6">
          <h2 className="font-semibold">Profile</h2>
          <div className="mt-3 flex flex-col gap-1 text-sm text-[var(--color-ink-soft)]">
            <p>Name: {profile.name}</p>
            {profile.dateOfBirth && <p>Date of birth: {new Date(profile.dateOfBirth).toLocaleDateString("en-GB")}</p>}
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

        <Card className="mt-4">
          <div className="flex items-center gap-2">
            <FolderKey size={18} className="text-[var(--color-amber)]" />
            <h2 className="font-semibold">MAAR Student Hub data center</h2>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-flag)]">
            <AlertTriangle size={13} /> Do not delete at any cost
          </div>
          <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
            A web page can&apos;t point you to a hidden folder on your device — browsers don&apos;t allow that, for
            your own security. Instead, this button gives you the real thing: a single file containing everything
            saved in MAAR Student Hub — your profile, subjects, notes, diagnostics, weaknesses and progress. Keep it
            somewhere safe. If you ever clear your browser data, this file is the only way to bring everything back.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={downloadDataFile}>
              <Download size={14} /> Download my data file
            </Button>
            <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} /> Restore from data file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".maar,.json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) restoreFromFile(file);
              }}
            />
          </div>
          {restoreMessage && (
            <p className={`mt-3 text-sm ${restoreMessage.tone === "ok" ? "text-[var(--color-primary)]" : "text-[var(--color-flag)]"}`}>
              {restoreMessage.text}
            </p>
          )}
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
