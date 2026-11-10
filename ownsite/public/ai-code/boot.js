// Runs before first paint; never leaves content dependent on a module loading.
if (
  !matchMedia("(prefers-reduced-motion: reduce)").matches &&
  window.IntersectionObserver &&
  document.createElement("canvas").getContext("2d")
) {
  document.documentElement.classList.add("boot-intro");
  window.aiBootTimeout = setTimeout(
    () => document.documentElement.classList.remove("boot-intro"),
    1800,
  );
}
