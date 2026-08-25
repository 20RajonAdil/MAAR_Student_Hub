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

The tutor's default path calls [OpenRouter](https://openrouter.ai) from a
server route (`app/api/tutor/route.ts`) so the API key and the underlying
model name never reach the browser or the student. Add your key to
`.env.local`:

```
OPENROUTER_API_KEY=sk-or-...
```

A list of models (27 by default) is tried in order — see `lib/ai/models.ts`,
overridable via `MAAR_TUTOR_MODELS`. If a model is out of credit or
rate-limited the next one in the list is tried automatically; nothing in
the UI ever names the model. Each model gets an 8s timeout so a hung
provider can't stall the whole chain — with 27 models this keeps the
worst-case wait bounded before falling back to the local tutor below.

**On-device fallback.** If every configured OpenRouter model is out of
credit/rate-limited (or no `OPENROUTER_API_KEY` is set at all), the browser
automatically switches to a local tutor built on
[WebLLM](https://github.com/mlc-ai/web-llm) running Llama-3.2-3B-Instruct
(or the 1B variant on lower-memory devices) via WebGPU — no key, no
account, no server call. The model downloads once and is cached by the
browser; requires a WebGPU-capable browser (recent Chrome/Edge; Safari/
Firefox support is still rolling out). See `lib/ai/webllm.ts`.

Either way, the tutor is grounded in the student's own resources (primary)
and notes (secondary/fallback) via simple on-device keyword retrieval —
see `lib/ai/retrieval.ts` and `lib/ai/resourceStore.ts`.

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
- **AI Tutor** (`/tutor`) — chat UI grounded by on-device keyword retrieval
  over the student's uploaded resources (primary) and notes (secondary),
  shown as source pills. Multi-model OpenRouter cloud tutor by default,
  automatic fallback to a fully local WebLLM (Llama 3.2) tutor when cloud
  models are exhausted; per-reply response-time indicator. Same
  teach-don't-just-answer, external-knowledge-disclosure, "ask/say when
  unsure" system prompt either way.
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
- **Document upload/indexing.** `/resources` now really extracts text
  on-device (PDF via `pdfjs-dist`, plain text/.md directly) and stores it
  in IndexedDB (`lib/ai/resourceStore.ts`), with keyword-overlap retrieval
  feeding real excerpts into the tutor. Not yet done: OCR for scanned/
  image-only PDFs, `.docx` support, and semantic (embedding-based) rather
  than keyword retrieval. `/past-papers` is still a UI-only stub.
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
