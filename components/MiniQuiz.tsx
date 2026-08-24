"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { Question } from "@/lib/types";

export function MiniQuiz({
  questions,
  passThreshold = 0.7,
  onComplete,
}: {
  questions: Question[];
  passThreshold?: number;
  onComplete: (result: { correct: number; total: number; passed: boolean }) => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  if (questions.length === 0) {
    return <p className="text-sm text-[var(--color-ink-soft)]">No questions available for this topic yet.</p>;
  }

  const q = questions[index];

  function answer(opt: string) {
    if (selected) return;
    setSelected(opt);
    const isCorrect = opt === q.correctAnswer;
    const newCount = correctCount + (isCorrect ? 1 : 0);
    setCorrectCount(newCount);
    setTimeout(() => {
      if (index + 1 < questions.length) {
        setIndex((i) => i + 1);
        setSelected(null);
      } else {
        const total = questions.length;
        onComplete({ correct: newCount, total, passed: newCount / total >= passThreshold });
      }
    }, 500);
  }

  return (
    <div>
      <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-black/5">
        <div className="h-full rounded-full bg-[var(--color-primary)] transition-all" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>
      <p className="text-sm font-medium">{q.prompt}</p>
      <div className="mt-3 flex flex-col gap-2">
        {q.options?.map((opt) => {
          const showState = selected !== null;
          const isCorrect = opt === q.correctAnswer;
          const isSelected = selected === opt;
          return (
            <button
              key={opt}
              disabled={showState}
              onClick={() => answer(opt)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                showState && isCorrect
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-dim)]"
                  : showState && isSelected
                  ? "border-[var(--color-flag)] bg-[var(--color-flag-dim)]"
                  : "border-[var(--color-line)] hover:border-[var(--color-primary)]"
              }`}
            >
              {opt}
              {showState && isCorrect && <CheckCircle2 size={16} className="text-[var(--color-primary)]" />}
              {showState && isSelected && !isCorrect && <XCircle size={16} className="text-[var(--color-flag)]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
