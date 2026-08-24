"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { useStore, SUBJECT_LIBRARY } from "@/lib/store";
import { generateDiagnosticQuestions } from "@/lib/diagnostics";
import { Button, Card, Pill } from "@/components/ui";
import type { Attempt, DiagnosticResult, Question } from "@/lib/types";

function DiagnosticFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const subjectIds = useMemo(() => (params.get("subjects") || "maths").split(","), [params]);

  const profile = useStore((s) => s.profile);
  const subjects = useStore((s) => s.subjects);
  const recordDiagnostic = useStore((s) => s.recordDiagnostic);

  const [subjectIndex, setSubjectIndex] = useState(0);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [phase, setPhase] = useState<"intro" | "running" | "result">("intro");
  const [startedAt, setStartedAt] = useState<number>(Date.now());

  const subjectId = subjectIds[subjectIndex];
  const questions: Question[] = useMemo(
    () => generateDiagnosticQuestions(subjectId, profile?.educationLevel ?? "gcse"),
    [subjectId, profile?.educationLevel]
  );
  const question = questions[qIndex];

  useEffect(() => {
    setPhase("intro");
    setQIndex(0);
    setAttempts([]);
    setSelected(null);
  }, [subjectIndex]);

  function beginSubject() {
    setStartedAt(Date.now());
    setPhase("running");
  }

  function answer(opt: string) {
    if (selected) return;
    setSelected(opt);
    const correct = opt === question.correctAnswer;
    setAttempts((prev) => [
      ...prev,
      { id: `${question.id}-a`, questionId: question.id, studentAnswer: opt, correct, attemptedAt: new Date().toISOString(), source: "diagnostic" },
    ]);
    setTimeout(() => {
      if (qIndex + 1 < questions.length) {
        setQIndex((i) => i + 1);
        setSelected(null);
      } else {
        finishSubject([...attempts, { id: `${question.id}-a`, questionId: question.id, studentAnswer: opt, correct, attemptedAt: new Date().toISOString(), source: "diagnostic" }]);
      }
    }, 550);
  }

  function finishSubject(finalAttempts: Attempt[]) {
    const subj = subjects.find((s) => s.id === subjectId);
    const strandScores: Record<string, { correct: number; total: number }> = {};
    finalAttempts.forEach((a) => {
      const q = questions.find((qq) => qq.id === a.questionId);
      if (!q) return;
      strandScores[q.topicId] ??= { correct: 0, total: 0 };
      strandScores[q.topicId].total += 1;
      if (a.correct === true) strandScores[q.topicId].correct += 1;
    });
    const strengths: string[] = [];
    const developing: string[] = [];
    const weaknesses: string[] = [];
    Object.entries(strandScores).forEach(([strand, sc]) => {
      const ratio = sc.correct / sc.total;
      if (ratio >= 0.8) strengths.push(strand);
      else if (ratio >= 0.4) developing.push(strand);
      else weaknesses.push(strand);

      // update topic mastery in store
      const topic = subj?.topics.find((t) => t.name === strand);
      if (topic) useStore.getState().updateTopicMastery(topic.id, Math.round(ratio * 60), ratio >= 0.8 ? "developing" : "learning");
    });

    const overallRatio = finalAttempts.filter((a) => a.correct === true).length / Math.max(1, finalAttempts.length);
    const estimatedAbility = overallRatio >= 0.85 ? "advanced" : overallRatio >= 0.65 ? "confident" : overallRatio >= 0.4 ? "secure" : "developing";

    const result: DiagnosticResult = {
      id: `${subjectId}-${Date.now()}`,
      subjectId,
      completedAt: new Date().toISOString(),
      durationMinutes: Math.max(1, Math.round((Date.now() - startedAt) / 60000)),
      estimatedAbility,
      strengths,
      developingAreas: developing,
      weaknesses,
      attempts: finalAttempts,
    };
    recordDiagnostic(result);
    setAttempts(finalAttempts);
    setPhase("result");
  }

  function nextSubjectOrFinish() {
    if (subjectIndex + 1 < subjectIds.length) {
      setSubjectIndex((i) => i + 1);
    } else {
      router.push("/dashboard");
    }
  }

  const subjectName = SUBJECT_LIBRARY[subjectId]?.name ?? subjectId;
  const correctCount = attempts.filter((a) => a.correct === true).length;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-6 py-12">
      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <Panel key="intro">
              <Pill tone="primary">
                Subject {subjectIndex + 1} of {subjectIds.length}
              </Pill>
              <h1 className="font-display mt-4 text-3xl font-semibold">{subjectName} check-in</h1>
              <p className="mt-3 text-[var(--color-ink-soft)]">
                About {Math.max(5, questions.length * 1.5) | 0} minutes. This finds your current level — it's not a
                test you can fail, and nothing here is an official grade.
              </p>
              <Button className="mt-8 w-full" size="lg" onClick={beginSubject} disabled={questions.length === 0}>
                Begin
              </Button>
            </Panel>
          )}

          {phase === "running" && question && (
            <Panel key={`q-${qIndex}`}>
              <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
                  style={{ width: `${((qIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
              <p className="text-xs font-medium tracking-wide text-[var(--color-ink-faint)] uppercase">{question.topicId}</p>
              <h2 className="font-display mt-2 text-2xl font-semibold">{question.prompt}</h2>
              <div className="mt-6 flex flex-col gap-2.5">
                {question.options?.map((opt) => {
                  const isSelected = selected === opt;
                  const isCorrect = opt === question.correctAnswer;
                  const showState = selected !== null;
                  return (
                    <button
                      key={opt}
                      onClick={() => answer(opt)}
                      disabled={selected !== null}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-[15px] transition-colors ${
                        showState && isCorrect
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-dim)]"
                          : showState && isSelected
                          ? "border-[var(--color-flag)] bg-[var(--color-flag-dim)]"
                          : "border-[var(--color-line)] hover:border-[var(--color-primary)]"
                      }`}
                    >
                      {opt}
                      {showState && isCorrect && <CheckCircle2 size={18} className="text-[var(--color-primary)]" />}
                      {showState && isSelected && !isCorrect && <XCircle size={18} className="text-[var(--color-flag)]" />}
                    </button>
                  );
                })}
              </div>
            </Panel>
          )}

          {phase === "result" && (
            <Panel key="result">
              <Pill tone="primary">{subjectName} — done</Pill>
              <h1 className="font-display mt-4 text-3xl font-semibold">
                {correctCount} of {attempts.length} — nice work
              </h1>
              <p className="mt-3 text-[var(--color-ink-soft)]">
                This is an educational estimate of where you're at right now, not an official grade. Your dashboard
                will show the full breakdown, and any developing areas become gentle, actionable goals.
              </p>
              <Button className="mt-8 w-full" size="lg" onClick={nextSubjectOrFinish}>
                {subjectIndex + 1 < subjectIds.length ? "Next subject" : "Go to my dashboard"}
              </Button>
            </Panel>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
      <Card className="p-8">{children}</Card>
    </motion.div>
  );
}

export default function DiagnosticPage() {
  return (
    <Suspense fallback={null}>
      <DiagnosticFlow />
    </Suspense>
  );
}
