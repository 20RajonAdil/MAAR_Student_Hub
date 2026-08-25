"use client";

// ─────────────────────────────────────────────────────────────────────────
// DEMO / MOCK DATA SERVICE
// This store simulates the backend so every screen can be built and tested
// end-to-end before real auth, a database, and the AI service are wired in.
// It persists to localStorage only — swap for real API calls behind the
// same action names when a production backend exists. Nothing here should
// be mistaken for production data handling: there is no server, no auth,
// and no encryption. Do not use for real student data.
// ─────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  StudentProfile,
  Subject,
  Topic,
  DiagnosticResult,
  Weakness,
  Note,
  StudySession,
  LearningPlanItem,
  ErrorJournalEntry,
  AIConversation,
  ActivityEvent,
  SubjectId,
  LearningPreferenceSignal,
} from "./types";

function id() {
  return Math.random().toString(36).slice(2, 10);
}
function nowISO() {
  return new Date().toISOString();
}

const SUBJECT_LIBRARY: Record<string, { name: string; color: string; icon: string; strands: string[] }> = {
  maths: {
    name: "Mathematics",
    color: "var(--sub-maths)",
    icon: "Sigma",
    strands: ["Number", "Fractions & Decimals", "Percentages & Ratio", "Algebra", "Equations", "Graphs", "Geometry", "Statistics"],
  },
  english: {
    name: "English",
    color: "var(--sub-english)",
    icon: "BookOpen",
    strands: ["Reading Comprehension", "Vocabulary", "Grammar & Punctuation", "Sentence Construction", "Analysis", "Writing"],
  },
  biology: { name: "Biology", color: "var(--sub-science)", icon: "Leaf", strands: ["Cells", "Organisation", "Ecology", "Genetics"] },
  chemistry: { name: "Chemistry", color: "var(--sub-science)", icon: "FlaskConical", strands: ["Atomic Structure", "Bonding", "Reactions", "Energy"] },
  physics: { name: "Physics", color: "var(--sub-science)", icon: "Atom", strands: ["Forces", "Energy", "Waves", "Electricity"] },
};

function makeTopics(subjectId: SubjectId): Topic[] {
  const strands = SUBJECT_LIBRARY[subjectId]?.strands ?? ["General"];
  return strands.map((strand) => ({
    id: id(),
    subjectId,
    name: strand,
    strand,
    status: "not-started",
    masteryScore: 0,
    evidenceCount: 0,
  }));
}

interface StoreState {
  profile: StudentProfile | null;
  subjects: Subject[];
  diagnostics: DiagnosticResult[];
  weaknesses: Weakness[];
  notes: Note[];
  sessions: StudySession[];
  planItems: LearningPlanItem[];
  errorJournal: ErrorJournalEntry[];
  conversations: AIConversation[];
  activity: ActivityEvent[];
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  // onboarding
  createProfile: (p: Omit<StudentProfile, "id" | "createdAt" | "onboardingComplete" | "learningPreferences">) => void;
  setLearningPreferences: (prefs: LearningPreferenceSignal[]) => void;
  activateSubjects: (subjectIds: SubjectId[]) => void;
  completeOnboarding: () => void;

  // diagnostics
  recordDiagnostic: (d: DiagnosticResult) => void;

  // notes
  upsertNote: (n: Partial<Note> & { subjectId: SubjectId }) => Note;
  deleteNote: (noteId: string) => void;

  // weaknesses
  addWeakness: (w: Omit<Weakness, "id" | "identifiedAt" | "status" | "verificationAttempts">) => void;
  requestVerification: (weaknessId: string, passed: boolean) => void;

  // study sessions
  startSession: (s: Omit<StudySession, "id" | "startedAt">) => string;
  endSession: (sessionId: string, patch: Partial<StudySession>) => void;

  // plan
  refreshPlan: () => void;
  togglePlanItem: (planItemId: string) => void;

  // error journal
  addErrorEntry: (e: Omit<ErrorJournalEntry, "id" | "createdAt">) => void;

  // AI
  addConversation: (c: Omit<AIConversation, "id" | "createdAt" | "updatedAt">) => string;
  appendMessage: (conversationId: string, msg: AIConversation["messages"][number]) => void;

  // activity
  logActivity: (e: Omit<ActivityEvent, "id" | "at">) => void;

  // topic mastery
  updateTopicMastery: (topicId: string, delta: number, newStatus?: Topic["status"]) => void;

  resetAll: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      profile: null,
      subjects: [],
      diagnostics: [],
      weaknesses: [],
      notes: [],
      sessions: [],
      planItems: [],
      errorJournal: [],
      conversations: [],
      activity: [],
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      createProfile: (p) =>
        set({
          profile: {
            ...p,
            id: id(),
            createdAt: nowISO(),
            onboardingComplete: false,
            learningPreferences: [],
          },
        }),

      setLearningPreferences: (prefs) =>
        set((s) => (s.profile ? { profile: { ...s.profile, learningPreferences: prefs } } : s)),

      activateSubjects: (subjectIds) =>
        set(() => ({
          subjects: subjectIds.map((sid) => {
            const lib = SUBJECT_LIBRARY[sid] ?? { name: sid, color: "var(--sub-other)", icon: "Book", strands: ["General"] };
            return {
              id: sid,
              name: lib.name,
              color: lib.color,
              icon: lib.icon,
              active: true,
              topics: makeTopics(sid),
            };
          }),
        })),

      completeOnboarding: () =>
        set((s) => (s.profile ? { profile: { ...s.profile, onboardingComplete: true } } : s)),

      recordDiagnostic: (d) => {
        set((s) => ({ diagnostics: [...s.diagnostics, d] }));
        // seed weaknesses positively-framed from diagnostic
        const weak = d.weaknesses.slice(0, 3);
        weak.forEach((topicName) => {
          const subj = get().subjects.find((sub) => sub.id === d.subjectId);
          const topic = subj?.topics.find((t) => t.name === topicName);
          if (topic) {
            get().addWeakness({
              subjectId: d.subjectId,
              topicId: topic.id,
              topicName,
              origin: "diagnostic",
              isInference: false,
              reason: `Your diagnostic showed this is an area we can improve together.`,
              recentEvidence: [`Diagnostic assessment, ${new Date(d.completedAt).toLocaleDateString("en-GB")}`],
            });
          }
        });
        get().refreshPlan();
        get().logActivity({ label: `Completed ${SUBJECT_LIBRARY[d.subjectId]?.name ?? d.subjectId} diagnostic`, subjectId: d.subjectId, kind: "diagnostic" });
      },

      upsertNote: (n) => {
        const existing = n.id ? get().notes.find((note) => note.id === n.id) : undefined;
        const note: Note = existing
          ? { ...existing, ...n, updatedAt: nowISO() } as Note
          : {
              id: id(),
              subjectId: n.subjectId,
              title: n.title ?? "Untitled note",
              contentHtml: n.contentHtml ?? "",
              topic: n.topic,
              createdAt: nowISO(),
              updatedAt: nowISO(),
            };
        set((s) => ({ notes: existing ? s.notes.map((x) => (x.id === note.id ? note : x)) : [...s.notes, note] }));
        if (!existing) get().logActivity({ label: `Created note "${note.title}"`, subjectId: note.subjectId, kind: "note" });
        return note;
      },

      deleteNote: (noteId) => set((s) => ({ notes: s.notes.filter((n) => n.id !== noteId) })),

      addWeakness: (w) =>
        set((s) => ({
          weaknesses: [
            ...s.weaknesses,
            { ...w, id: id(), identifiedAt: nowISO(), status: "active", verificationAttempts: 0 },
          ],
        })),

      requestVerification: (weaknessId, passed) => {
        set((s) => ({
          weaknesses: s.weaknesses.map((w) =>
            w.id === weaknessId
              ? {
                  ...w,
                  verificationAttempts: w.verificationAttempts + 1,
                  status: passed ? "resolved" : "active",
                }
              : w
          ),
        }));
        const w = get().weaknesses.find((x) => x.id === weaknessId);
        if (w && passed) {
          get().updateTopicMastery(w.topicId, 40, "mastered");
          get().logActivity({ label: `Verified ${w.topicName}`, subjectId: w.subjectId, kind: "verification" });
        }
      },

      startSession: (sSession) => {
        const sessionId = id();
        set((s) => ({ sessions: [...s.sessions, { ...sSession, id: sessionId, startedAt: nowISO() }] }));
        return sessionId;
      },

      endSession: (sessionId, patch) => {
        set((s) => ({ sessions: s.sessions.map((sess) => (sess.id === sessionId ? { ...sess, ...patch, endedAt: nowISO() } : sess)) }));
        const sess = get().sessions.find((x) => x.id === sessionId);
        if (sess) get().logActivity({ label: `Completed a study session`, subjectId: sess.subjectId, kind: "session" });
      },

      refreshPlan: () => {
        const weaknesses = get().weaknesses.filter((w) => w.status === "active");
        const items: LearningPlanItem[] = weaknesses.slice(0, 6).map((w) => ({
          id: id(),
          subjectId: w.subjectId,
          topicId: w.topicId,
          reason: w.reason,
          priority: 1,
          suggestedAction: `Practise ${w.topicName}`,
          done: false,
        }));
        set({ planItems: items });
      },

      togglePlanItem: (planItemId) =>
        set((s) => ({ planItems: s.planItems.map((p) => (p.id === planItemId ? { ...p, done: !p.done } : p)) })),

      addErrorEntry: (e) => set((s) => ({ errorJournal: [...s.errorJournal, { ...e, id: id(), createdAt: nowISO() }] })),

      addConversation: (c) => {
        const convoId = id();
        set((s) => ({ conversations: [...s.conversations, { ...c, id: convoId, createdAt: nowISO(), updatedAt: nowISO() }] }));
        return convoId;
      },

      appendMessage: (conversationId, msg) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId ? { ...c, messages: [...c.messages, msg], updatedAt: nowISO() } : c
          ),
        })),

      logActivity: (e) => set((s) => ({ activity: [{ ...e, id: id(), at: nowISO() }, ...s.activity].slice(0, 50) })),

      updateTopicMastery: (topicId, delta, newStatus) =>
        set((s) => ({
          subjects: s.subjects.map((sub) => ({
            ...sub,
            topics: sub.topics.map((t) =>
              t.id === topicId
                ? {
                    ...t,
                    masteryScore: Math.max(0, Math.min(100, t.masteryScore + delta)),
                    status: newStatus ?? t.status,
                    lastPractisedAt: nowISO(),
                    evidenceCount: t.evidenceCount + 1,
                  }
                : t
            ),
          })),
        })),

      // NOTE: `conversations` (AI Tutor chat history) is deliberately left
      // out of this reset. Chat history is preserved permanently — even a
      // full "reset my data" from Settings must not delete it. There is no
      // action anywhere in the store that clears `conversations`.
      resetAll: () =>
        set({
          profile: null,
          subjects: [],
          diagnostics: [],
          weaknesses: [],
          notes: [],
          sessions: [],
          planItems: [],
          errorJournal: [],
          activity: [],
        }),
    }),
    {
      name: "maar-study-hub-demo-store",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export { SUBJECT_LIBRARY };
