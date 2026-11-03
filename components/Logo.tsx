import Link from "next/link";

export function LogoMark({ size = 36 }: { size?: number }) {
  const bars = [0.35, 0.62, 0.95, 0.62, 0.35];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="#0e5a3a" />
      <circle cx="35" cy="13" r="5.5" fill="#f4b41a" />
      {bars.map((h, i) => (
        <rect key={i} x={9 + i * 6.4} y={26 - (h * 26) / 2 + 2} width="4" height={h * 26} rx="2" fill="#fbf5e9" />
      ))}
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="Kan, accueil">
      <LogoMark />
      <span>Kan</span>
    </Link>
  );
}
