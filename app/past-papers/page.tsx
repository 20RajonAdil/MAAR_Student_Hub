"use client";

import { useRef, useState } from "react";
import { Upload, FileStack, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore } from "@/lib/store";
import { Button, Card, Pill } from "@/components/ui";

export default function PastPapersPage() {
  const { ready } = useRequireProfile();
  const subjects = useStore((s) => s.subjects);
  const [uploaded, setUploaded] = useState<{ name: string; status: "analysing" | "done" }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ready) return null;

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const items = Array.from(files).map((f) => ({ name: f.name, status: "analysing" as const }));
    setUploaded((u) => [...items, ...u]);
    items.forEach((it) => {
      setTimeout(() => {
        setUploaded((u) => u.map((x) => (x.name === it.name ? { ...x, status: "done" } : x)));
      }, 1600);
    });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="font-display text-3xl font-semibold">Past paper analysis</h1>
        <p className="mt-1 max-w-2xl text-[var(--color-ink-soft)]">
          Upload a question paper you're allowed to use — and your answers or a mark scheme if you have them — for an
          estimated breakdown of how you did.
        </p>

        <Card className="mt-4 flex items-start gap-3 border-[var(--color-amber)]/40 bg-[var(--color-amber-dim)]">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#8a5c17]" />
          <p className="text-sm text-[#5c4110]">
            Any score shown here is an AI estimate, not an official examination mark, and may contain errors. Only
            upload papers you have the rights or permission to use — MAAR Study Hub doesn't host copyrighted exam
            papers itself, and links to official board sources where possible.
          </p>
        </Card>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Upload paper
          </Button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <span className="text-xs text-[var(--color-ink-faint)]">{subjects.length} subject{subjects.length === 1 ? "" : "s"} active</span>
        </div>

        {uploaded.length === 0 ? (
          <Card className="mt-6 flex flex-col items-center gap-2 py-16 text-center">
            <FileStack size={28} className="text-[var(--color-ink-faint)]" />
            <p className="text-sm text-[var(--color-ink-soft)]">No papers uploaded yet.</p>
          </Card>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {uploaded.map((u) => (
              <Card key={u.name} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-[var(--color-ink-faint)]">{u.status === "analysing" ? "Identifying questions and topics…" : "Analysis ready"}</p>
                </div>
                <Pill tone={u.status === "done" ? "primary" : "amber"}>{u.status === "done" ? "Estimated score ready" : "Analysing…"}</Pill>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
