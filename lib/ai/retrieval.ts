"use client";

// ─────────────────────────────────────────────────────────────────────────
// Local retrieval for the AI Tutor.
//
// Deliberately simple keyword-overlap ranking rather than embeddings —
// it's fast, needs no extra model download, runs instantly on-device, and
// is transparent about why a passage matched. Resources are the primary
// source (uploaded course materials); notes are the fallback/secondary
// source, matching how the student actually uses the app.
// ─────────────────────────────────────────────────────────────────────────

import { getAllChunksWithTitles } from "./resourceStore";
import type { Note } from "../types";

export interface RetrievedExcerpt {
  title: string;
  excerpt: string;
  source: "resource" | "note";
}

function scoreText(words: string[], text: string): number {
  const lower = text.toLowerCase();
  return words.filter((w) => lower.includes(w)).length;
}

export async function retrieveContext(
  question: string,
  notes: Note[],
  subjectId: string | undefined,
  opts: { maxResourceExcerpts?: number; maxNoteExcerpts?: number } = {}
): Promise<RetrievedExcerpt[]> {
  const words = question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const maxResource = opts.maxResourceExcerpts ?? 3;
  const maxNote = opts.maxNoteExcerpts ?? 2;

  // Primary: uploaded resources.
  let resourceExcerpts: RetrievedExcerpt[] = [];
  try {
    const chunks = await getAllChunksWithTitles();
    resourceExcerpts = chunks
      .filter((c) => (subjectId ? c.subjectId === subjectId : true))
      .map((c) => ({ ...c, hits: scoreText(words, c.text) }))
      .filter((c) => c.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, maxResource)
      .map((c) => ({ title: c.title, excerpt: c.text.slice(0, 500), source: "resource" as const }));
  } catch (err) {
    // IndexedDB can be unavailable (private browsing in some browsers) —
    // fail soft and just skip resource retrieval rather than blocking the
    // tutor entirely.
    console.warn("Resource retrieval unavailable", err);
  }

  // Secondary/fallback: the student's own notes, only filled in if
  // resources didn't turn up enough.
  const noteExcerpts: RetrievedExcerpt[] =
    resourceExcerpts.length >= maxResource
      ? []
      : notes
          .filter((n) => (subjectId ? n.subjectId === subjectId : true))
          .map((n) => {
            const text = n.contentHtml.replace(/<[^>]+>/g, " ");
            return { note: n, hits: scoreText(words, text), text };
          })
          .filter((x) => x.hits > 0)
          .sort((a, b) => b.hits - a.hits)
          .slice(0, maxNote)
          .map((x) => ({ title: x.note.title, excerpt: x.text.slice(0, 400), source: "note" as const }));

  return [...resourceExcerpts, ...noteExcerpts];
}
