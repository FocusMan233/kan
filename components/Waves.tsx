"use client";

import { useMemo } from "react";

/** Ondes sonores animées en CSS (légères, adaptées aux petits téléphones). */
export function Waves({
  bars = 28,
  idle = false,
  color = "currentColor",
  height = 56,
}: {
  bars?: number;
  idle?: boolean;
  color?: string;
  height?: number;
}) {
  const items = useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => ({
        delay: -((i * 0.137) % 1.2),
        duration: 0.9 + ((i * 7) % 5) * 0.12,
      })),
    [bars],
  );
  return (
    <div className={`waves${idle ? " idle" : ""}`} style={{ color, height }} aria-hidden="true">
      {items.map((b, i) => (
        <span key={i} style={{ animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s` }} />
      ))}
    </div>
  );
}
