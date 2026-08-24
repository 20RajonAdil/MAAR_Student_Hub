"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, BrainCircuit, NotebookPen, LineChart, MessageCircle } from "lucide-react";
import { MasteryMap } from "@/components/MasteryMap";
import { FloatingSymbols } from "@/components/FloatingSymbols";
import { Button, Card, Pill } from "@/components/ui";

const LOOP = ["Assess", "Understand", "Learn", "Practise", "Verify", "Track", "Review"];

const FEATURES = [
  {
    icon: BrainCircuit,
    title: "Weakness detection that stays current",
    body: "Recent evidence carries the most weight, so a struggle from three months ago doesn't define you forever.",
  },
  {
    icon: ShieldCheck,
    title: "\"Prove it\" verification",
    body: "You can't tick a weakness away. A short check confirms real understanding before it's marked resolved.",
  },
  {
    icon: MessageCircle,
    title: "An AI Tutor that teaches",
    body: "It reads your notes first, gives hints before answers, and always says when it's used outside knowledge.",
  },
  {
    icon: NotebookPen,
    title: "Notes that organise themselves",
    body: "Write by subject and lesson — MAAR keeps it structured and searchable, and autosaves as you go.",
  },
  {
    icon: LineChart,
    title: "Progress you can actually read",
    body: "One clear graph per subject, built from diagnostics and practice — not a wall of confusing numbers.",
  },
  {
    icon: Sparkles,
    title: "A plan that keeps adjusting",
    body: "Every result — a practice set, a past paper, a verified topic — updates what you're asked to do next.",
  },
];

export default function LandingPage() {
  return (
    <div className="bg-[var(--color-paper)]">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[var(--color-line)]">
        <FloatingSymbols />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-28">
          <div>
            <Pill tone="primary">Built for Maths &amp; English first</Pill>
            <h1 className="font-display mt-5 max-w-xl text-[2.6rem] leading-[1.08] font-semibold tracking-tight md:text-6xl">
              Find out what you struggle with. Learn it properly. Watch it change.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--color-ink-soft)]">
              MAAR Study Hub is a personal learning space that gets to know your level, teaches at your pace,
              and only calls a topic done once you've genuinely proven you understand it.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/onboarding">
                <Button size="lg">
                  Start Learning <ArrowRight size={18} />
                </Button>
              </Link>
              <a href="#how-it-works" className="text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                See how it works
              </a>
            </div>
            <p className="mt-6 text-xs text-[var(--color-ink-faint)]">
              Free to start. We only ask for what's needed to personalise your learning.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative mx-auto aspect-square w-full max-w-sm md:max-w-none"
          >
            <div className="card-surface h-full w-full p-6">
              <p className="mb-2 text-xs font-medium tracking-wide text-[var(--color-ink-faint)] uppercase">
                Your topic mastery map
              </p>
              <div className="h-[calc(100%-2rem)]">
                <MasteryMap variant="hero" seed={7} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Learning loop ────────────────────────────────────────── */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-sm font-semibold text-[var(--color-primary)]">How it works</p>
        <h2 className="font-display mt-2 max-w-xl text-3xl font-semibold md:text-4xl">
          One continuous loop — not a pile of disconnected features.
        </h2>
        <div className="mt-10 flex flex-wrap gap-2">
          {LOOP.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className="card-surface flex items-center gap-2 px-4 py-2.5">
                <span className="font-mono text-xs text-[var(--color-ink-faint)]">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm font-medium">{step}</span>
              </div>
              {i < LOOP.length - 1 && <ArrowRight size={16} className="text-[var(--color-ink-faint)]" />}
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-2xl text-[var(--color-ink-soft)]">
          A diagnostic identifies where you're at. Weaknesses become goals with real evidence behind them.
          Notes, practice and the AI Tutor all feed the same plan. Nothing is marked mastered until you've
          proven it — and mastery is reviewed again over time, so it stays real.
        </p>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section className="border-t border-[var(--color-line)] bg-[var(--color-paper-raised)]/50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display max-w-lg text-3xl font-semibold md:text-4xl">Everything stays connected to your actual learning.</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <f.icon size={22} className="text-[var(--color-primary)]" strokeWidth={1.8} />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">{f.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="card-surface mx-auto flex max-w-4xl flex-col items-center gap-6 p-12 text-center">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Ready to see where you're at?</h2>
          <p className="max-w-md text-[var(--color-ink-soft)]">
            A short, level-appropriate check-in for each subject — around ten minutes — is all it takes to get started.
          </p>
          <Link href="/onboarding">
            <Button size="lg">
              Start Learning <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--color-line)] px-6 py-8 text-center text-xs text-[var(--color-ink-faint)]">
        MAAR Study Hub is an educational assistant, not a replacement for teachers or professional support.
      </footer>
    </div>
  );
}
