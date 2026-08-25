"use client";

import { useEffect, useRef, useState } from "react";
import { FolderOpen, Upload, FileText, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore } from "@/lib/store";
import { Button, Card, Pill } from "@/components/ui";
import { addResource, updateResource, listResources, deleteResource, type ResourceRecord } from "@/lib/ai/resourceStore";
import { extractTextFromFile } from "@/lib/ai/extractText";
import { saveExtractedText } from "@/lib/ai/resourceStore";

export default function ResourcesPage() {
  const { ready } = useRequireProfile();
  const subjects = useStore((s) => s.subjects);
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listResources().then(setResources).catch(() => setResources([]));
  }, []);

  if (!ready) return null;

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const record = await addResource({
        title: file.name,
        subjectId: subjects[0]?.id ?? "maths",
        mimeType: file.type,
        sizeBytes: file.size,
      });
      setResources((r) => [record, ...r]);

      // Extraction happens on-device, in the background, one file at a
      // time — nothing about the file's content leaves the browser.
      extractTextFromFile(file)
        .then(async (result) => {
          if (result.text !== null) {
            await saveExtractedText(record.id, result.text);
          } else {
            await updateResource(record.id, { status: "no-readable-text", errorMessage: result.reason });
          }
          const fresh = await listResources();
          setResources(fresh);
        })
        .catch(async (err) => {
          console.error("Resource processing failed", err);
          await updateResource(record.id, { status: "error", errorMessage: "Something went wrong reading this file." });
          const fresh = await listResources();
          setResources(fresh);
        });
    }
  }

  async function handleDelete(id: string) {
    await deleteResource(id);
    setResources((r) => r.filter((x) => x.id !== id));
  }

  const filtered = resources.filter((r) => r.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold">Resource library</h1>
            <p className="mt-1 text-[var(--color-ink-soft)]">
              Your notes, papers and course materials — stored and read on this device only, and used by the AI Tutor
              as its primary source of information.
            </p>
          </div>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Upload
          </Button>
          <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
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
            <p className="text-sm text-[var(--color-ink-soft)]">
              Your resource library starts here — upload a PDF or text file to get going. Supported for now: PDF, .txt, .md.
            </p>
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
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                      {subject?.name ?? "Unfiled"} · {new Date(r.uploadedAt).toLocaleDateString("en-GB")}
                    </p>
                    <Pill tone={r.status === "ready" ? "primary" : r.status === "error" ? "flag" : "amber"} className="mt-2">
                      {r.status === "processing"
                        ? "Processing…"
                        : r.status === "ready"
                          ? "Ready"
                          : r.status === "error"
                            ? "Couldn't read this file"
                            : "No readable text found"}
                    </Pill>
                    {r.errorMessage && r.status !== "ready" && (
                      <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{r.errorMessage}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-[var(--color-ink-faint)] hover:text-[var(--color-flag)]"
                    aria-label={`Delete ${r.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
