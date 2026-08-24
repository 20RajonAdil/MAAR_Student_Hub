"use client";

import { useRef, useState } from "react";
import { FolderOpen, Upload, FileText, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore } from "@/lib/store";
import { Button, Card, Pill } from "@/components/ui";

interface ResourceMeta {
  id: string;
  title: string;
  subjectId: string;
  topic?: string;
  uploadedAt: string;
  status: "processing" | "ready" | "no-readable-text";
}

export default function ResourcesPage() {
  const { ready } = useRequireProfile();
  const subjects = useStore((s) => s.subjects);
  const [resources, setResources] = useState<ResourceMeta[]>([]);
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ready) return null;

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const additions: ResourceMeta[] = Array.from(files).map((f) => ({
      id: `${Date.now()}-${f.name}`,
      title: f.name,
      subjectId: subjects[0]?.id ?? "maths",
      uploadedAt: new Date().toISOString(),
      status: "processing",
    }));
    setResources((r) => [...additions, ...r]);
    // Demo only: simulate processing completing. A real backend would
    // extract text (OCR for scans) and index it for retrieval.
    additions.forEach((a) => {
      setTimeout(() => {
        setResources((r) => r.map((x) => (x.id === a.id ? { ...x, status: "ready" } : x)));
      }, 1400);
    });
  }

  const filtered = resources.filter((r) => r.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold">Resource library</h1>
            <p className="mt-1 text-[var(--color-ink-soft)]">Your notes, papers and course materials, organised and searchable.</p>
          </div>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Upload
          </Button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-4 py-2">
          <Search size={16} className="text-[var(--color-ink-faint)]" />
          <input
            className="flex-1 border-none bg-transparent text-sm outline-none"
            placeholder="Search your resources…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <Card className="mt-6 flex flex-col items-center gap-2 py-16 text-center">
            <FolderOpen size={28} className="text-[var(--color-ink-faint)]" />
            <p className="text-sm text-[var(--color-ink-soft)]">Your resource library starts here — upload a document to get going.</p>
          </Card>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {filtered.map((r) => {
              const subject = subjects.find((s) => s.id === r.subjectId);
              return (
                <Card key={r.id} className="flex items-start gap-3">
                  <FileText size={18} className="mt-0.5 text-[var(--color-ink-faint)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{subject?.name ?? "Unfiled"} · {new Date(r.uploadedAt).toLocaleDateString("en-GB")}</p>
                    <Pill tone={r.status === "ready" ? "primary" : "amber"} className="mt-2">
                      {r.status === "processing" ? "Processing…" : r.status === "ready" ? "Ready" : "No readable text found"}
                    </Pill>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
