"use client";

import { useRef, useState } from "react";
import { Upload, FileStack, AlertTriangle, Eye, Download, Trash2, Loader2 } from "lucide-react";
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

export default function PastPapersPage() {
  const { ready } = useRequireProfile();
  const subjects = useStore((s) => s.subjects);
  const pastPapers = useStore((s) => s.pastPapers);
  const addPastPaper = useStore((s) => s.addPastPaper);
  const removePastPaper = useStore((s) => s.removePastPaper);
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
        const fileId = `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await saveFileBlob(fileId, file);
        addPastPaper({
          fileId,
          title: file.name,
          subjectId: subjects[0]?.id,
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

  async function handleDelete(paperId: string, fileId: string) {
    if (!confirm("Remove this past paper? This can't be undone.")) return;
    await deleteFileBlob(fileId).catch(() => {});
    removePastPaper(paperId);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="font-display text-3xl font-semibold">Past papers</h1>
        <p className="mt-1 max-w-2xl text-[var(--color-ink-soft)]">
          Upload and organise question papers you&apos;re allowed to use, so they&apos;re all in one place alongside the rest
          of your revision.
        </p>

        <Card className="mt-4 flex items-start gap-3 border-[var(--color-amber)]/40 bg-[var(--color-amber-dim)]">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#8a5c17]" />
          <p className="text-sm text-[#5c4110]">
            Automatic scoring and question-by-question analysis isn&apos;t available yet — this section stores and
            organises your papers for now. Only upload papers you have the rights or permission to use; MAAR Study
            Hub doesn&apos;t host copyrighted exam papers itself.
          </p>
        </Card>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
            {uploading > 0 ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading > 0 ? `Saving ${uploading}…` : "Upload paper"}
          </Button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <span className="text-xs text-[var(--color-ink-faint)]">{subjects.length} subject{subjects.length === 1 ? "" : "s"} active</span>
        </div>

        {error && <p className="mt-3 text-sm text-[var(--color-flag)]">{error}</p>}

        {pastPapers.length === 0 ? (
          <Card className="mt-6 flex flex-col items-center gap-2 py-16 text-center">
            <FileStack size={28} className="text-[var(--color-ink-faint)]" />
            <p className="text-sm text-[var(--color-ink-soft)]">No papers uploaded yet.</p>
          </Card>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {pastPapers.map((p) => {
              const subject = p.subjectId ? subjects.find((s) => s.id === p.subjectId) ?? SUBJECT_LIBRARY[p.subjectId] : undefined;
              return (
                <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">
                      {subject?.name ?? "Unfiled"} · {formatBytes(p.sizeBytes)} · {new Date(p.uploadedAt).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill>Stored on this device</Pill>
                    <button
                      className="flex items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-black/[0.08]"
                      onClick={() => openStoredFile(p.fileId, p.title, "view").catch((e) => setError(e.message))}
                    >
                      <Eye size={11} /> View
                    </button>
                    <button
                      className="flex items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-black/[0.08]"
                      onClick={() => openStoredFile(p.fileId, p.title, "download").catch((e) => setError(e.message))}
                    >
                      <Download size={11} /> Download
                    </button>
                    <button
                      className="flex items-center gap-1 rounded-full bg-[var(--color-flag-dim)] px-2.5 py-1 text-xs font-medium text-[var(--color-flag)] hover:brightness-95"
                      onClick={() => handleDelete(p.id, p.fileId)}
                    >
                      <Trash2 size={11} /> Remove
                    </button>
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
