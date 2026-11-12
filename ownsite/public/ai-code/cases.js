import { trackGoal } from './events.js';

export function enhanceCases(reduced) {
  const grid = document.querySelector('.cases-grid');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.case-card')];
  const animations = new Map();
  const toggle = card => card.querySelector('.case-toggle');
  const panel = card => document.getElementById(toggle(card).getAttribute('aria-controls'));
  function setOpen(card, open) {
    animations.get(card)?.cancel();
    animations.delete(card);
    const body = panel(card);
    const button = toggle(card);
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'Свернуть −' : 'Как решили +';
    card.dataset.open = String(open);
    // Hide synchronously: closing content immediately leaves the tab order.
    body.hidden = !open;
    if (open && !reduced.matches && body.animate) {
      const animation = body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
      animations.set(card, animation);
      animation.onfinish = () => animations.delete(card);
    }
  }
  for (const card of cards) {
    const button = toggle(card);
    setOpen(card, false);
    button.hidden = false;
    button.addEventListener('click', () => {
      const before = button.getBoundingClientRect().top;
      const open = button.getAttribute('aria-expanded') !== 'true';
      for (const other of cards) if (other !== card) setOpen(other, false);
      setOpen(card, open);
      // Compensate for a preceding card collapsing, especially on mobile.
      const delta = button.getBoundingClientRect().top - before;
      if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: 'instant' });
      if (open) trackGoal('case_open', { code: card.dataset.case, source: 'user' });
    });
  }
  // Share natural preview row heights without constraining expanded stories.
  function alignPreviews() {
    for (let row = 0; row < 4; row++) grid.style.removeProperty(`--case-row-${row}`);
    if (innerWidth < 900) return;
    for (let row = 0; row < 4; row++) {
      const height = Math.max(...cards.map(card => card.querySelector('.case-preview').children[row].getBoundingClientRect().height));
      grid.style.setProperty(`--case-row-${row}`, `${height}px`);
    }
  }
  let width;
  if (window.ResizeObserver) new ResizeObserver(entries => {
    const next = entries[0].contentRect.width;
    if (next !== width) { width = next; alignPreviews(); }
  }).observe(grid);
  window.addEventListener('resize', alignPreviews, { passive: true });
  document.fonts?.ready.then(alignPreviews);
  alignPreviews();
  reduced.addEventListener('change', () => {
    if (reduced.matches) { for (const animation of animations.values()) animation.cancel(); animations.clear(); }
  });
}
