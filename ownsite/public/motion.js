// Decorative feedback never owns navigation or the selected work.
export function createMotion(root = document) {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Map();
  const observed = new Set();
  const seen = new WeakSet();
  let observer = null;
  let wasReduced = preference.matches;

  function cancelAll() {
    for (const animation of running.values()) animation.cancel();
    running.clear();
  }

  function play(element, frames, duration, name) {
    if (!element) return;
    running.get(element)?.cancel();
    if (preference.matches || typeof element.animate !== 'function') return;
    let animation;
    try {
      animation = element.animate(frames, {
        duration, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'none', id: name
      });
    } catch { return; } // An unavailable effect must not break a link.
    running.set(element, animation);
    const clean = () => {
      if (running.get(element) === animation) running.delete(element);
    };
    animation.addEventListener('finish', clean, { once: true });
    animation.addEventListener('cancel', clean, { once: true });
  }

  function watch() {
    if (!observer || preference.matches) return;
    for (const element of observed) {
      if (!element.isConnected) { observer.unobserve(element); observed.delete(element); }
    }
    for (const element of root.querySelectorAll('[data-reveal]')) {
      if (seen.has(element) || observed.has(element)) continue;
      observed.add(element);
      observer.observe(element);
    }
  }

  function updatePreference() {
    root.documentElement.toggleAttribute('data-reduced-motion', preference.matches);
    if (preference.matches) {
      cancelAll();
      observer?.disconnect();
      observed.clear();
      // Stop an in-flight native smooth scroll when the preference changes.
      if (!wasReduced) root.defaultView?.scrollTo({
        top: root.defaultView.scrollY, left: root.defaultView.scrollX, behavior: 'instant'
      });
    } else watch();
    wasReduced = preference.matches;
  }

  if (typeof IntersectionObserver === 'function') {
    try {
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target;
          seen.add(element);
          element.dataset.revealSeen = 'true';
          observer.unobserve(element);
          observed.delete(element);
          // Underlying styles stay visible, even if this animation fails.
          play(element, [
            { opacity: 0, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'translateY(0)' }
          ], 260, 'section-enter');
        }
      }, { threshold: 0, rootMargin: '0px 0px -12px 0px' });
    } catch { observer = null; }
  }
  preference.addEventListener('change', updatePreference);
  updatePreference();

  return {
    get reduced() { return preference.matches; },
    watch,
    sync: updatePreference,
    feedback(element) {
      const arrow = element?.querySelector('.arrow');
      play(arrow, [
        { transform: 'translate(0,0)' },
        { transform: 'translate(3px,-2px)', offset: .45 },
        { transform: 'translate(0,0)' }
      ], 150, 'action-acknowledge');
    },
    openTicket(element) {
      play(element?.querySelector('.ticket-tab'), [
        { transform: 'translateY(0) rotate(0deg)' },
        { transform: 'translateY(-3px) rotate(-2deg)', offset: .5 },
        { transform: 'translateY(0) rotate(0deg)' }
      ], 240, 'paper-open');
    },
    showCase(mode, revealing = false) {
      const element = root.querySelector(mode === 'reveal' ? '.case-reveal' : '.case-view');
      play(element, revealing ? [
        { opacity: .35, transform: 'perspective(700px) rotateX(-5deg) translateY(5px)' },
        { opacity: 1, transform: 'perspective(700px) rotateX(0deg) translateY(0)' }
      ] : [
        { opacity: .55, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], revealing ? 260 : 200, revealing ? 'case-reveal' : 'case-select');
    },
    chooseRoute(route) {
      for (const article of root.querySelectorAll('.approach-grid article')) {
        article.classList.toggle('is-chosen', article.querySelector('[data-route]')?.dataset.route === route);
      }
      const context = root.querySelector('#contact-intent');
      play(context, [
        { opacity: .3, transform: 'translateY(3px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], 180, 'contact-context');
    },
    destroy() {
      cancelAll();
      observer?.disconnect();
      observed.clear();
      preference.removeEventListener('change', updatePreference);
    }
  };
}
