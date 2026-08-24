"use client";

import { motion } from "framer-motion";

const SYMBOLS = ["∑", "π", "√", "÷", "%", "∞", "θ", "¶", "“ ”", "＋", "x²", "≈"];

export function FloatingSymbols({ count = 18 }: { count?: number }) {
  const items = Array.from({ length: count }, (_, i) => {
    const symbol = SYMBOLS[i % SYMBOLS.length];
    const left = (i * 137.5) % 100; // golden-angle spread, avoids clumping
    const size = 14 + ((i * 7) % 26);
    const duration = 14 + ((i * 5) % 12);
    const delay = (i % 6) * -2.3;
    const opacity = 0.05 + ((i % 4) * 0.02);
    return { symbol, left, size, duration, delay, opacity, key: i };
  });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {items.map((it) => (
        <motion.span
          key={it.key}
          className="font-display absolute select-none"
          style={{
            left: `${it.left}%`,
            fontSize: it.size,
            color: "var(--color-ink)",
            opacity: it.opacity,
          }}
          initial={{ y: "110%", rotate: -6 }}
          animate={{ y: "-20%", rotate: 6 }}
          transition={{ duration: it.duration, delay: it.delay, repeat: Infinity, ease: "linear" }}
        >
          {it.symbol}
        </motion.span>
      ))}
    </div>
  );
}
