// A small first-paint guard; failure always resolves to complete native content.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && window.IntersectionObserver && Element.prototype.animate && !location.hash) {
  document.documentElement.classList.add('boot-intro');
  window.aiBootTimeout = setTimeout(() => document.documentElement.classList.remove('boot-intro'), 1000);
}
