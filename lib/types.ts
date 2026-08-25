// ─────────────────────────────────────────────────────────────────────────
// MAAR Study Hub — core domain types
// These types are the contract between the (currently mock) data layer in
// lib/store.ts and every screen. Swap store.ts for real API/DB calls later
// without touching components — they only depend on these shapes.
// ─────────────────────────────────────────────────────────────────────────

export type EducationLevel =
  | "ks3"
  | "gcse"
  | "a-level"
  | "college-btec"
  | "other";

export type ExamBoard = "aqa" | "edexcel" | "ocr" | "wjec-eduqas" | "other" | "not-applicable";

export interface StudentProfile {
  id: string;
  name: string;
  dateOfBirth?: string; // ISO date, optional — never required
  schoolOrCollege?: string;
  educationLevel: EducationLevel;
  yearOrGroup: string;
  examBoard?: ExamBoard;
  onboardingComplete: boolean;
  createdAt: string;
  learningPreferences: LearningPreferenceSignal[];
}

/** Preferences are treated as *signals*, never a fixed "learning style" label. */
export interface LearningPreferenceSignal {
  type: "visual" | "reading-writing" | "examples" | "practice" | "diagrams" | "step-by-step";
  strength: number; // 0-1, updated over time by both stated preference and performance
}

export type SubjectId = "maths" | "english" | "biology" | "chemistry" | "physics" | string;

export interface Subject {
  id: SubjectId;
  name: string;
  color: string; // CSS var name, e.g. 'var(--sub-maths)'
  icon: string; // lucide icon name
  active: boolean;
  topics: Topic[];
}

export type MasteryStatus =
  | "not-started"
  | "learning"
  | "practising"
  | "developing"
  | "ready-for-verification"
  | "mastered"
  | "needs-review";

export interface Topic {
  id: string;
  subjectId: SubjectId;
  name: string;
  strand: string; // e.g. "Algebra", "Reading comprehension"
  status: MasteryStatus;
  masteryScore: number; // 0-100, decays over time without practice
  lastPractisedAt?: string;
  evidenceCount: number;
}

export type QuestionType = "multiple-choice" | "short-answer" | "long-answer" | "numeric";

export interface Question {
  id: string;
  subjectId: SubjectId;
  topicId: string;
  type: QuestionType;
  difficulty: 1 | 2 | 3 | 4 | 5;
  prompt: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Attempt {
  id: string;
  questionId: string;
  studentAnswer: string;
  correct: boolean | "partial";
  timeTakenSeconds?: number;
  confidence?: 1 | 2 | 3 | 4 | 5;
  attemptedAt: string;
  source: "diagnostic" | "practice" | "verification" | "past-paper";
}

export interface DiagnosticResult {
  id: string;
  subjectId: SubjectId;
  completedAt: string;
  durationMinutes: number;
  estimatedAbility: "developing" | "secure" | "confident" | "advanced"; // never an "official grade"
  strengths: string[]; // topic names
  developingAreas: string[];
  weaknesses: string[];
  attempts: Attempt[];
}

export type WeaknessOrigin = "diagnostic" | "practice-pattern" | "past-paper" | "note-analysis" | "inferred";

export interface Weakness {
  id: string;
  subjectId: SubjectId;
  topicId: string;
  topicName: string;
  identifiedAt: string;
  origin: WeaknessOrigin;
  isInference: boolean; // true = AI suspicion, not yet confirmed by hard evidence
  reason: string; // plain-language explanation, positively framed
  recentEvidence: string[];
  status: "active" | "ready-to-verify" | "resolved";
  verificationAttempts: number;
}

export interface Note {
  id: string;
  subjectId: SubjectId;
  title: string;
  contentHtml: string;
  topic?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudySession {
  id: string;
  subjectId: SubjectId;
  topicId?: string;
  technique: "focus-block" | "active-recall" | "spaced-repetition" | "interleaving";
  plannedMinutes: number;
  actualMinutes?: number;
  completedTask?: string;
  retrievalCheckPassed?: boolean;
  startedAt: string;
  endedAt?: string;
}

export interface LearningPlanItem {
  id: string;
  subjectId: SubjectId;
  topicId: string;
  reason: string;
  priority: 1 | 2 | 3;
  suggestedAction: string;
  done: boolean;
}

export interface ErrorJournalEntry {
  id: string;
  subjectId: SubjectId;
  topicId: string;
  pattern:
    | "calculation-mistake"
    | "concept-misunderstanding"
    | "missed-command-word"
    | "weak-vocabulary"
    | "poor-explanation"
    | "method-application";
  whatHappened: string;
  whyItMayHaveHappened: string;
  howToAvoid: string;
  createdAt: string;
}

export type AIMessageRole = "student" | "tutor";

export interface AIMessage {
  id: string;
  role: AIMessageRole;
  content: string;
  usedSources?: { title: string; type: "note" | "resource" | "external" }[];
  createdAt: string;
  elapsedMs?: number; // how long this reply took to generate
  answeredBy?: "cloud" | "local"; // which tutor engine produced this reply
}

export interface AIConversation {
  id: string;
  subjectId?: SubjectId;
  topic?: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEvent {
  id: string;
  label: string; // e.g. "Verified Fractions"
  subjectId?: SubjectId;
  at: string;
  kind: "practice" | "note" | "upload" | "verification" | "diagnostic" | "session" | "past-paper";
}
