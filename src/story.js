export const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
export function sceneState(progress) {
  const p = clamp(progress, 0, 4);
  const moon = smooth(.30, .90, p);
  const opening = smooth(1.15, 1.90, p);
  const orbit = smooth(2.15, 2.95, p);
  const exit = smooth(3.35, 3.95, p);
  return { p, moon, opening, orbit, exit, scale: mix(mix(1, .89, moon), .75, opening) * mix(1, .85, orbit), shell: 1 - orbit, chapter: Math.min(3, Math.round(p)) };
}
export function scrollProgress(scrollY, anchors) {
  if (scrollY <= anchors[0]) return 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (scrollY < anchors[i + 1]) return i + (scrollY - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]);
  }
  return anchors.length - 1;
}
export function renderScale(width, height, dpr) {
  return Math.min(dpr || 1, width < 761 ? 1.35 : 1.5, Math.sqrt(2200000 / Math.max(1, width * height)));
}
