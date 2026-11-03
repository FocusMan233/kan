"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SLOTS, Slot } from "@/lib/images";

/**
 * Affiche /images/<slot>.jpg avec un léger zoom animé.
 * Tant qu'aucune photo n'est déposée, une illustration aux couleurs du Burkina prend la place.
 */
export function Photo({
  slot,
  className = "",
  style,
  priority = false,
}: {
  slot: Slot;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
}) {
  const meta = SLOTS[slot];
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const reduce = useReducedMotion();

  // Si l'image a échoué avant l'hydratation, onError ne se déclenche pas : on revérifie.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    <div className={`photo ${className}`} style={style}>
      {failed ? (
        <Art hue={meta.hue} label={meta.alt} />
      ) : (
        <motion.img
          ref={ref}
          src={`/images/${slot}.jpg`}
          alt={meta.alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          initial={reduce ? false : { scale: 1.12 }}
          whileInView={reduce ? undefined : { scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </div>
  );
}

function Art({ hue, label }: { hue: number; label: string }) {
  const uid = useId().replace(/:/g, "");
  const a = `hsl(${hue} 62% 34%)`;
  const b = `hsl(${(hue + 34) % 360} 78% 52%)`;
  const c = `hsl(${(hue + 190) % 360} 55% 22%)`;
  return (
    <svg className="art" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="0.6" stopColor={c} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
        <pattern id={`p${uid}`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M0 40 L20 0 L40 40 Z" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="2" />
          <circle cx="20" cy="30" r="2.5" fill="rgba(255,255,255,.16)" />
        </pattern>
      </defs>
      <rect width="400" height="400" fill={`url(#g${uid})`} />
      <rect width="400" height="400" fill={`url(#p${uid})`} />
      <circle cx="300" cy="110" r="46" fill="#f4b41a" opacity=".95" />
      {[60, 95, 135, 180].map((r, i) => (
        <circle key={r} cx="130" cy="260" r={r} fill="none" stroke="#fbf5e9" strokeOpacity={0.5 - i * 0.1} strokeWidth="3">
          <animate attributeName="r" values={`${r};${r + 14};${r}`} dur={`${3 + i * 0.6}s`} repeatCount="indefinite" />
        </circle>
      ))}
      <circle cx="130" cy="260" r="26" fill="#fbf5e9" />
      <path d="M118 248 h8 v24 h-8z M134 240 h8 v40 h-8z M150 250 h8 v20 h-8z" fill="#0e5a3a" transform="translate(-10 0)" />
    </svg>
  );
}
