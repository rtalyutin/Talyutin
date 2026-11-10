// Milliseconds; all motion timings and rendering limits live here.
export const motion = Object.freeze({
  heroRain: 650,
  heroAssemble: 2600,
  rain: 220,
  assemble: 1050,
  maxDpr: 1.5,
  maxParticles: 2800,
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
