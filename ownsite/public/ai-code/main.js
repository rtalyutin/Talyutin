import { enhanceFounders } from './founders.js';
import { enhanceCases } from './cases.js';
import { createScheduler } from './motion/glyph-renderer.js';
import { createStudioMotion, enhanceDetails } from './motion/studio.js';
import { createCatGaze } from './motion/cat-gaze.js';
import { createCatVolume } from './motion/cat-volume.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
enhanceFounders();
enhanceCases(reduced);
let scheduler, controller, gaze, volume;
function staticMode() {
  controller?.finishAll();
  gaze?.stop();
  volume?.neutral();
  scheduler?.clear();
  document.documentElement.classList.remove('boot-intro');
  for (const section of document.querySelectorAll('main > section')) section.dataset.state = 'ready';
}
try {
  enhanceDetails(reduced);
  if (!reduced.matches && window.IntersectionObserver && Element.prototype.animate) {
    scheduler = createScheduler(staticMode);
    controller = createStudioMotion([...document.querySelectorAll('main > section:not(#team)')], document.querySelector('#code-layer'), scheduler);
    const cat = document.querySelector('#cat');
    // Start with a separate SVG image. Allocate WebGL only on a desktop interaction.
    const activateCat = event => {
      if (reduced.matches || cat.getBoundingClientRect().bottom < 0) return;
      window.removeEventListener('pointermove', activateCat);
      try { volume = createCatVolume(cat); } catch { /* The SVG is a complete fallback. */ }
      if (volume) {
        gaze = createCatGaze(cat, scheduler, () => controller.records[0].state === 'ready', volume, { x: event.clientX, y: event.clientY });
        gaze.wake();
      } else cat.dataset.renderer = 'fallback';
    };
    if (matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', activateCat, { passive: true });
  } else staticMode();
  reduced.addEventListener('change', event => { if (event.matches) staticMode(); });
} catch { staticMode(); }
document.documentElement.classList.remove('boot-intro');
clearTimeout(window.aiBootTimeout);

// Native details keeps the mobile navigation usable before JS loads.
const mobileMenu = document.querySelector('.mobile-menu');
mobileMenu?.addEventListener('click', event => {
  if (event.target.closest('a')) mobileMenu.open = false;
});
mobileMenu?.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    mobileMenu.open = false;
    mobileMenu.querySelector('summary').focus();
  }
});
