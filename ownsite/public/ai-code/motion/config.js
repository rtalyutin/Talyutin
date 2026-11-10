// Milliseconds; all motion timings and rendering limits live here.
export const motion = Object.freeze({
  heroRain: 650,
  heroAssemble: 2600,
  rain: 220,
  assemble: 1050,
  maxDpr: 1.5,
  headingInkOpacity: 0.72,
  rainColumnWidth: 14,
  rainRowHeight: 12,
  rainFontSize: 11,
  rainSpeed: 0.12,
  rainOpacity: 0.5,
  captureSweep: 0.62,
  gazeEase: 0.14,
  gazeLimitX: 10,
  gazeLimitY: 7,
});
export const alphabet = "01:;+=<>/{}@#*";
export const clamp = (v, low, high) => Math.min(high, Math.max(low, v));
export function phase(elapsed, hero = false) {
  const rain = hero ? motion.heroRain : motion.rain;
  const assemble = hero ? motion.heroAssemble : motion.assemble;
  return elapsed < rain
    ? { state: "rain", progress: 0 }
    : elapsed < rain + assemble
      ? { state: "assemble", progress: (elapsed - rain) / assemble }
      : { state: "ready", progress: 1 };
}

// Each column has one downward capture front. A glyph is revealed exactly where
// it belongs when this front reaches its row; it never moves towards that point.
export function rainColumn(x) {
  return Math.floor(x / motion.rainColumnWidth);
}
export function columnStart(column) {
  return 0.035 + (((column * 73 + 19) % 101) / 101) * 0.28;
}
export function captureProgress(x, y, height) {
  return (
    columnStart(rainColumn(x)) +
    motion.captureSweep * clamp(y / Math.max(1, height), 0, 1)
  );
}
