"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

/**
 * MasteryMap: a constellation of topic nodes connected by lines, sized by
 * mastery. Used as the hero's signature visual (with demo values) and later
 * as the real "topic mastery" view once a subject has data — so the hero
 * isn't decorative, it's previewing an actual product feature.
 */
export function MasteryMap({
  variant = "hero",
  seed = 1,
}: {
  variant?: "hero" | "compact";
  seed?: number;
}) {
  const nodes = useMemo(() => {
    const count = variant === "hero" ? 14 : 8;
    const rand = mulberry32(seed);
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 10 + rand() * 80,
      y: 8 + rand() * 84,
      r: 3 + rand() * 6,
      mastery: rand(),
      delay: rand() * 3,
    }));
  }, [variant, seed]);

  const edges = useMemo(() => {
    const list: [number, number][] = [];
    nodes.forEach((n, i) => {
      const next = nodes[(i + 1) % nodes.length];
      const dist = Math.hypot(n.x - next.x, n.y - next.y);
      if (dist < 55) list.push([n.id, next.id]);
      const skip = nodes[(i + 3) % nodes.length];
      const dist2 = Math.hypot(n.x - skip.x, n.y - skip.y);
      if (dist2 < 40) list.push([n.id, skip.id]);
    });
    return list;
  }, [nodes]);

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {edges.map(([a, b], i) => {
        const na = nodes[a];
        const nb = nodes[b];
        return (
          <motion.line
            key={`e-${i}`}
            x1={na.x}
            y1={na.y}
            x2={nb.x}
            y2={nb.y}
            stroke="var(--color-primary)"
            strokeOpacity={0.18}
            strokeWidth={0.3}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, delay: na.delay * 0.15, ease: "easeOut" }}
          />
        );
      })}
      {nodes.map((n) => (
        <motion.circle
          key={n.id}
          cx={n.x}
          cy={n.y}
          r={n.r}
          fill={n.mastery > 0.66 ? "var(--color-primary)" : n.mastery > 0.33 ? "var(--color-amber)" : "var(--color-flag)"}
          fillOpacity={0.55}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.15, 1], opacity: 1, cy: [n.y, n.y - 1.5, n.y] }}
          transition={{
            scale: { duration: 0.6, delay: n.delay * 0.2 },
            opacity: { duration: 0.6, delay: n.delay * 0.2 },
            cy: { duration: 4 + n.delay, repeat: Infinity, ease: "easeInOut" },
          }}
        />
      ))}
    </svg>
  );
}

/** Small deterministic PRNG so the constellation is stable per render. */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
