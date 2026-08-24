"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Card, Pill } from "@/components/ui";
import type { EducationLevel, ExamBoard, SubjectId } from "@/lib/types";

const LEVELS: { id: EducationLevel; label: string }[] = [
  { id: "ks3", label: "Key Stage 3" },
  { id: "gcse", label: "GCSE" },
  { id: "a-level", label: "A-Level" },
  { id: "college-btec", label: "College / BTEC" },
  { id: "other", label: "Other" },
];

const BOARDS: { id: ExamBoard; label: string }[] = [
  { id: "aqa", label: "AQA" },
  { id: "edexcel", label: "Pearson Edexcel" },
  { id: "ocr", label: "OCR" },
  { id: "wjec-eduqas", label: "WJEC / Eduqas" },
  { id: "not-applicable", label: "Not sure / N/A" },
];

const PRIORITY_SUBJECTS: { id: SubjectId; label: string }[] = [
  { id: "maths", label: "Mathematics" },
  { id: "english", label: "English" },
];
const MORE_SUBJECTS: { id: SubjectId; label: string }[] = [
  { id: "biology", label: "Biology" },
  { id: "chemistry", label: "Chemistry" },
  { id: "physics", label: "Physics" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const createProfile = useStore((s) => s.createProfile);
  const activateSubjects = useStore((s) => s.activateSubjects);
  const completeOnboarding = useStore((s) => s.completeOnboarding);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<EducationLevel>("gcse");
  const [yearOrGroup, setYearOrGroup] = useState("");
  const [school, setSchool] = useState("");
  const [board, setBoard] = useState<ExamBoard>("not-applicable");
  const [subjects, setSubjects] = useState<SubjectId[]>(["maths", "english"]);

  const steps = ["Why we ask", "About you", "Your subjects"];

  function toggleSubject(id: SubjectId) {
    setSubjects((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function finish() {
    createProfile({ name: name.trim() || "Student", educationLevel: level, yearOrGroup: yearOrGroup.trim(), schoolOrCollege: school.trim() || undefined, examBoard: board });
    activateSubjects(subjects.length ? subjects : ["maths"]);
    completeOnboarding();
    router.push(`/onboarding/diagnostic?subjects=${(subjects.length ? subjects : ["maths"]).join(",")}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className="h-1.5 flex-1 rounded-full"
                style={{ background: i <= step ? "var(--color-primary)" : "var(--color-line)" }}
              />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <Step key="why">
              <Pill tone="primary">
                <ShieldCheck size={13} /> Just what's needed
              </Pill>
              <h1 className="font-display mt-4 text-3xl font-semibold">A few quick details first</h1>
              <p className="mt-3 text-[var(--color-ink-soft)]">
                We ask for your level and subjects so questions and explanations are pitched right for you — not
                generic. We only collect what's actually needed to personalise your learning, nothing more, and you
                can change or delete this later in Settings.
              </p>
              <Button className="mt-8 w-full" size="lg" onClick={() => setStep(1)}>
                Continue <ArrowRight size={18} />
              </Button>
            </Step>
          )}

          {step === 1 && (
            <Step key="about">
              <h1 className="font-display text-3xl font-semibold">About you</h1>
              <p className="mt-2 text-sm text-[var(--color-ink-soft)]">This helps us pick the right level of question.</p>
              <div className="mt-6 flex flex-col gap-4">
                <Field label="First name">
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                </Field>
                <Field label="School or college (optional)">
                  <input className="input" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Optional" />
                </Field>
                <Field label="Education level">
                  <div className="flex flex-wrap gap-2">
                    {LEVELS.map((l) => (
                      <Chip key={l.id} active={level === l.id} onClick={() => setLevel(l.id)}>
                        {l.label}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label="Year / group">
                  <input className="input" value={yearOrGroup} onChange={(e) => setYearOrGroup(e.target.value)} placeholder="e.g. Year 10" />
                </Field>
                <Field label="Exam board (if relevant)">
                  <div className="flex flex-wrap gap-2">
                    {BOARDS.map((b) => (
                      <Chip key={b.id} active={board === b.id} onClick={() => setBoard(b.id)}>
                        {b.label}
                      </Chip>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="mt-8 flex gap-3">
                <Button variant="secondary" onClick={() => setStep(0)}>
                  <ArrowLeft size={18} />
                </Button>
                <Button className="flex-1" size="lg" onClick={() => setStep(2)} disabled={!name.trim()}>
                  Continue <ArrowRight size={18} />
                </Button>
              </div>
            </Step>
          )}

          {step === 2 && (
            <Step key="subjects">
              <h1 className="font-display text-3xl font-semibold">Which subjects first?</h1>
              <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                We start with Maths and English — you can add more any time.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {PRIORITY_SUBJECTS.map((s) => (
                  <SubjectTile key={s.id} label={s.label} active={subjects.includes(s.id)} onClick={() => toggleSubject(s.id)} />
                ))}
              </div>
              <p className="mt-6 mb-2 text-xs font-medium tracking-wide text-[var(--color-ink-faint)] uppercase">Add more (optional)</p>
              <div className="grid grid-cols-3 gap-3">
                {MORE_SUBJECTS.map((s) => (
                  <SubjectTile key={s.id} label={s.label} active={subjects.includes(s.id)} onClick={() => toggleSubject(s.id)} small />
                ))}
              </div>
              <div className="mt-8 flex gap-3">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  <ArrowLeft size={18} />
                </Button>
                <Button className="flex-1" size="lg" onClick={finish} disabled={subjects.length === 0}>
                  Start my diagnostic <ArrowRight size={18} />
                </Button>
              </div>
            </Step>
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid var(--color-line);
          border-radius: 12px;
          padding: 10px 14px;
          background: white;
          font-size: 14.5px;
        }
        .input:focus {
          outline: 2px solid var(--color-primary);
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
      <Card className="p-8">{children}</Card>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--color-ink-faint)] uppercase">{label}</span>
      {children}
    </label>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "border-[var(--color-primary)] bg-[var(--color-primary-dim)] text-[var(--color-primary)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function SubjectTile({ label, active, onClick, small }: { label: string; active: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-all ${small ? "text-sm" : "text-base font-medium"} ${
        active ? "border-[var(--color-primary)] bg-[var(--color-primary-dim)]" : "border-[var(--color-line)] hover:border-[var(--color-primary)]"
      }`}
    >
      {label}
      {active && <div className="mt-1 text-xs text-[var(--color-primary)]">Selected</div>}
    </button>
  );
}
