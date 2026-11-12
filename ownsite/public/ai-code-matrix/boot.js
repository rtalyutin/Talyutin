// Before first paint. A failed module/network always releases the complete page.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !matchMedia('(forced-colors: active)').matches && window.IntersectionObserver) {
  document.documentElement.classList.add('matrix-boot');
  window.matrixBootTimeout = setTimeout(() => {
    document.documentElement.classList.remove('matrix-boot');
    window.matrixBootExpired = true;
  }, 2500);
}
