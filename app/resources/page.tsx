"use client";

import { useRef, useState } from "react";
import { FolderOpen, Upload, FileText, Search, Eye, Download, Trash2, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore, SUBJECT_LIBRARY } from "@/lib/store";
import { saveFileBlob, deleteFileBlob, openStoredFile } from "@/lib/fileStore";
import { Button, Card, Pill } from "@/components/ui";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResourcesPage() {
  const { ready } = useRequireProfile();
  const subjects = useStore((s) => s.subjects);
  const resources = useStore((s) => s.resources);
  const addResource = useStore((s) => s.addResource);
  const removeResource = useStore((s) => s.removeResource);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ready) return null;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files);
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        const fileId = `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await saveFileBlob(fileId, file);
        addResource({
          fileId,
          title: file.name,
          subjectId: subjects[0]?.id ?? "maths",
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that file to local storage.");
      } finally {
        setUploading((n) => Math.max(0, n - 1));
      }
    }
  }

  async function handleDelete(resourceId: string, fileId: string) {
    if (!confirm("Remove this resource? This can't be undone.")) return;
    await deleteFileBlob(fileId).catch(() => {});
    removeResource(resourceId);
  }

  const filtered = resources.filter((r) => r.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Resource library</h1>
            <p className="mt-1 text-[var(--color-ink-soft)]">
              Your notes, papers and course materials, stored on this device — open or download anytime.
            </p>
          </div>
          <Button onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
            {uploading > 0 ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading > 0 ? `Saving ${uploading}…` : "Upload"}
          </Button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </div>

        {error && <p className="mt-3 text-sm text-[var(--color-flag)]">{error}</p>}

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
                  <FileText size={18} className="mt-0.5 shrink-0 text-[var(--color-ink-faint)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                      {subject?.name ?? SUBJECT_LIBRARY[r.subjectId]?.name ?? "Unfiled"} · {formatBytes(r.sizeBytes)} ·{" "}
                      {new Date(r.uploadedAt).toLocaleDateString("en-GB")}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Pill tone="primary">Stored on this device</Pill>
                      <button
                        className="flex items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-black/[0.08]"
                        onClick={() => openStoredFile(r.fileId, r.title, "view").catch((e) => setError(e.message))}
                      >
                        <Eye size={11} /> View
                      </button>
                      <button
                        className="flex items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-black/[0.08]"
                        onClick={() => openStoredFile(r.fileId, r.title, "download").catch((e) => setError(e.message))}
                      >
                        <Download size={11} /> Download
                      </button>
                      <button
                        className="flex items-center gap-1 rounded-full bg-[var(--color-flag-dim)] px-2.5 py-1 text-xs font-medium text-[var(--color-flag)] hover:brightness-95"
                        onClick={() => handleDelete(r.id, r.fileId)}
                      >
                        <Trash2 size={11} /> Remove
                      </button>
                    </div>
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
