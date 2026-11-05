// Niveau de qualité détecté une seule fois (?quality=high|mid|low pour forcer).
const qs = new URLSearchParams(location.search);
function detect() {
  const f = qs.get('quality'); if (['high', 'mid', 'low'].includes(f)) return f;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const mem = navigator.deviceMemory || (mobile ? 4 : 8), cores = navigator.hardwareConcurrency || 4;
  if (mem <= 2 || (mobile && cores <= 4 && mem <= 3)) return 'low';
  if (mobile || mem <= 4) return 'mid';
  return 'high';
}
export const quality = detect();
// finesse des formes arrondies (troncs, dômes, personnages…)
export const DETAIL = { high: { seg: 24, sw: 24, sh: 16, cap: [8, 18], ico: 2 }, mid: { seg: 16, sw: 18, sh: 12, cap: [5, 12], ico: 1 }, low: { seg: 10, sw: 12, sh: 8, cap: [3, 8], ico: 1 } }[quality];
export const PIXEL_MAX = { high: 2.5, mid: 2, low: 1.5 }[quality];
