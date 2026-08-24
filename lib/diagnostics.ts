import type { EducationLevel, Question, SubjectId } from "./types";
import { SUBJECT_LIBRARY } from "./store";

// ─────────────────────────────────────────────────────────────────────────
// DEMO diagnostic bank. Real implementation should pull from a proper
// question bank or an AI Question Generator constrained to the student's
// level/exam board — this exists so the diagnostic flow can be fully built
// and tested end to end.
// ─────────────────────────────────────────────────────────────────────────

const MATHS_BANK: Record<string, { prompt: string; options: string[]; answer: string; difficulty: 1 | 2 | 3 | 4 | 5 }[]> = {
  Number: [
    { prompt: "What is 7 × 8?", options: ["54", "56", "58", "64"], answer: "56", difficulty: 1 },
    { prompt: "Round 4,582 to the nearest hundred.", options: ["4,500", "4,600", "4,580", "4,000"], answer: "4,600", difficulty: 2 },
  ],
  "Fractions & Decimals": [
    { prompt: "What is 3/4 as a decimal?", options: ["0.34", "0.75", "0.43", "1.33"], answer: "0.75", difficulty: 2 },
    { prompt: "Simplify 8/12.", options: ["2/3", "3/4", "4/6", "1/2"], answer: "2/3", difficulty: 2 },
  ],
  "Percentages & Ratio": [
    { prompt: "What is 20% of 150?", options: ["20", "30", "35", "40"], answer: "30", difficulty: 2 },
    { prompt: "Share £60 in the ratio 2:1.", options: ["£40 and £20", "£30 and £30", "£45 and £15", "£50 and £10"], answer: "£40 and £20", difficulty: 3 },
  ],
  Algebra: [
    { prompt: "Simplify 3x + 2x.", options: ["5x", "6x", "5x²", "x"], answer: "5x", difficulty: 2 },
    { prompt: "If x + 5 = 12, what is x?", options: ["5", "6", "7", "17"], answer: "7", difficulty: 2 },
  ],
  Equations: [
    { prompt: "Solve 2x − 4 = 10.", options: ["3", "5", "7", "14"], answer: "7", difficulty: 3 },
  ],
  Graphs: [
    { prompt: "A line has equation y = 2x + 1. What is the gradient?", options: ["1", "2", "3", "0"], answer: "2", difficulty: 3 },
  ],
  Geometry: [
    { prompt: "How many degrees are in a triangle's interior angles?", options: ["90", "180", "270", "360"], answer: "180", difficulty: 1 },
  ],
  Statistics: [
    { prompt: "What is the mean of 2, 4, 6, 8?", options: ["4", "5", "6", "20"], answer: "5", difficulty: 2 },
  ],
};

const ENGLISH_BANK: Record<string, { prompt: string; options: string[]; answer: string; difficulty: 1 | 2 | 3 | 4 | 5 }[]> = {
  "Reading Comprehension": [
    { prompt: "What is the term for the main message of a text?", options: ["Theme", "Simile", "Rhyme", "Stanza"], answer: "Theme", difficulty: 2 },
  ],
  Vocabulary: [
    { prompt: "Which word is closest in meaning to 'reluctant'?", options: ["Eager", "Unwilling", "Careless", "Confident"], answer: "Unwilling", difficulty: 2 },
  ],
  "Grammar & Punctuation": [
    { prompt: "Which sentence uses an apostrophe correctly?", options: ["The dog's bone.", "The dogs' bone (one dog).", "The dogs bone.", "Its' bone."], answer: "The dog's bone.", difficulty: 2 },
  ],
  "Sentence Construction": [
    { prompt: "Which is a complete sentence?", options: ["Running fast.", "She ran fast.", "Because she ran.", "Fast and running."], answer: "She ran fast.", difficulty: 1 },
  ],
  Analysis: [
    { prompt: "\"The wind howled\" is an example of which technique?", options: ["Personification", "Alliteration", "Rhyme", "Metaphor"], answer: "Personification", difficulty: 3 },
  ],
  Writing: [
    { prompt: "Which connective signals contrast?", options: ["Furthermore", "However", "Therefore", "Similarly"], answer: "However", difficulty: 2 },
  ],
};

const BANKS: Record<string, typeof MATHS_BANK> = { maths: MATHS_BANK, english: ENGLISH_BANK };

/** Used for practice sessions and "prove it" verification checks — pulls
 * from the same demo bank, filtered to one strand/topic. */
export function getQuestionsForTopic(subjectId: SubjectId, topicName: string, level: EducationLevel): Question[] {
  return generateDiagnosticQuestions(subjectId, level).filter((q) => q.topicId === topicName);
}

export function generateDiagnosticQuestions(subjectId: SubjectId, level: EducationLevel): Question[] {
  const bank = BANKS[subjectId];
  if (!bank) return [];
  const strands = SUBJECT_LIBRARY[subjectId]?.strands ?? [];
  const questions: Question[] = [];
  strands.forEach((strand) => {
    const items = bank[strand];
    if (!items) return;
    items.forEach((item, idx) => {
      questions.push({
        id: `${subjectId}-${strand}-${idx}`.replace(/\s+/g, "-"),
        subjectId,
        topicId: strand,
        type: "multiple-choice",
        difficulty: level === "ks3" ? Math.max(1, item.difficulty - 1) as 1 | 2 | 3 | 4 | 5 : item.difficulty,
        prompt: item.prompt,
        options: item.options,
        correctAnswer: item.answer,
        explanation: `The correct answer is "${item.answer}".`,
      });
    });
  });
  return questions;
}
