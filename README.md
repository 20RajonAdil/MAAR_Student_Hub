# MAAR Study Hub

A personalised learning platform for students who struggle with Maths and English —
diagnostic assessment, a mastery-tracked dashboard, an AI Tutor grounded in the
student's own notes, a verification-gated weakness tracker, notes, and a study coach.

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your OpenRouter key
npm run dev
```

Open http://localhost:3000. Click **Start Learning** to go through onboarding →
diagnostic → dashboard.

### AI Tutor setup

The tutor calls [OpenRouter](https://openrouter.ai) from a server route
(`app/api/tutor/route.ts`) so the API key and the underlying model name never
reach the browser or the student. Add your key to `.env.local`:

```
OPENROUTER_API_KEY=sk-or-...
```

Only one model is used, set server-side in `app/api/tutor/route.ts` via
`MAAR_TUTOR_MODEL` (defaults to a strong general-purpose model suited to
teaching). Nothing in the UI ever names the model.

## What's implemented

- **Landing page** — animated hero (floating symbol particles + a "mastery
  map" that previews the real progress visual), learning-loop explainer,
  feature grid.
- **Onboarding** — why-we-ask explainer -> profile (level, year, exam board,
  school optional) -> subject selection (Maths/English first, more optional).
- **Diagnostic** — per-subject, level-aware questions, produces a
  positively-framed estimated ability (never "official grade"), seeds
  weaknesses and topic mastery.
- **Dashboard** — Focus Today, a real progress chart built from diagnostic
  history, expandable subject cards, active goals, recent activity.
- **Subject workspace** (`/subjects/[id]`) — Overview, Notes (autosaving,
  contentEditable), Practice (per-topic mini-quiz that raises mastery),
  Weaknesses (**"I'm ready to prove it"** verification quiz — a weakness only
  resolves on a passing check), Error Journal, Progress.
- **AI Tutor** (`/tutor`) — chat UI with simple client-side note retrieval
  (keyword match against the student's own notes, shown as source pills),
  server-side system prompt that enforces teach-don't-just-answer behaviour,
  external-knowledge disclosure, and "ask when unsure."
- **Study Coach** — technique picker (focus block / active recall / spaced
  repetition / interleaving), timer, post-session retrieval check.
- **Notes, Resources, Past Papers, Progress, Settings** — functional shells;
  see "Still a stub" below for what's mocked.

## Architecture notes

- `lib/types.ts` — the whole domain model (Student, Subject, Topic, Question,
  Attempt, Weakness, Note, StudySession, LearningPlanItem, AIConversation…).
  Everything else is built against these shapes.
- `lib/store.ts` — a Zustand store persisted to `localStorage`, standing in
  for a real backend. It's explicitly labelled as a demo/mock service —
  swap the action bodies for real API calls without touching any component.
- `lib/diagnostics.ts` — demo question bank + generator, filtered by
  subject/topic/level. Swap for a real question bank or an AI Question
  Generator later.
- `app/api/tutor/route.ts` — the only place the OpenRouter key and model
  name exist. Builds a context-limited system prompt per request instead of
  sending the student's whole history.
- Design tokens live in `app/globals.css` (`@theme inline` block) — warm
  paper background, teal-emerald primary, amber for focus/streaks, and a
  distinct color per subject so multi-subject screens stay legible.

## Still a stub — needs real infrastructure to go to production

- **Auth & database.** Everything currently lives in the browser via
  Zustand + localStorage. Swap `lib/store.ts` for real API calls behind a
  proper backend with per-student auth before this holds real student data.
- **Document upload/OCR/indexing.** `/resources` and `/past-papers` show the
  intended UX (processing states, status pills) but don't actually extract
  or index text — wire in real storage + OCR + a retrieval index, then feed
  real excerpts into the tutor's context builder in `app/tutor/page.tsx`.
- **Past-paper marking.** No real mark-scheme comparison yet — the upload
  flow and "estimated score, not an official mark" framing are in place,
  ready for a real analysis pipeline.
- **AI Question Generator.** Diagnostic/practice questions come from a small
  static demo bank per topic; replace with real generation constrained to
  level/exam board/prior mistakes.
- **Mastery decay & spaced review.** Topic status includes `needs-review`
  in the type system, but nothing yet ages mastery down over time — add a
  scheduled job or a check-on-load calculation.
- Because students may be minors, treat the data-minimisation and privacy
  choices here as a floor, not a ceiling, once real accounts are involved.
