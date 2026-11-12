import { studioMotion as motion } from './config.js';

// All transient rendering is disposable. HTML remains the source of content.
export function createStudioMotion(sections, canvas, scheduler) {
  const context = canvas.getContext('2d');
  const records = sections.filter(element => element.id !== 'cases').map(element => ({ element, state: 'pending', animations: [], timer: 0 }));
  let observer;
  const resizeCanvas = () => {
    if (!context) return;
    const dpr = Math.min(devicePixelRatio || 1, motion.maxDpr);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const clear = () => context?.clearRect(0, 0, innerWidth, innerHeight);
  const finish = record => {
    clearTimeout(record.timer);
    for (const animation of record.animations) animation.cancel();
    record.animations.length = 0;
    record.state = 'ready';
    record.element.dataset.state = 'ready';
    observer?.unobserve(record.element);
  };
  const animate = (record, element, keyframes, options) => {
    if (!element?.animate) return;
    record.animations.push(element.animate(keyframes, { easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'both', ...options }));
  };
  const task = time => {
    clear();
    let active = false;
    for (const record of records) {
      if (record.state !== 'active') continue;
      const rect = record.element.getBoundingClientRect();
      const progress = Math.min(1, (time - record.start) / record.duration);
      if (progress >= 1 || rect.bottom < 0 || rect.top > innerHeight) { finish(record); continue; }
      active = true;
      if (!context) continue;
      const title = record.element.querySelector('h1, h2').getBoundingClientRect();
      // A sparse code scan stays inside the title; it cannot cover controls.
      context.save();
      context.beginPath();
      context.rect(title.left, title.top, title.width, title.height);
      context.clip();
      context.font = `${motion.codeSize}px monospace`;
      context.fillStyle = '#477a48';
      const front = title.top + title.height * Math.min(1.1, progress * 1.5);
      for (let x = title.left + 4, column = 0; x < title.right; x += motion.codeStep, column++) {
        for (let row = 0; row < 4; row++) {
          const y = front + ((column * 7) % 23) - row * 12;
          context.globalAlpha = motion.codeOpacity * (1 - progress) * (1 - row / 4);
          context.fillText('01<>/{}*+'[(column + row + Math.floor(time / 110)) % 9], x, y);
        }
      }
      context.restore();
    }
    return active;
  };
  const start = record => {
    if (record.state !== 'pending') return;
    const hero = record.element.id === 'intro';
    record.state = 'active';
    record.element.dataset.state = 'active';
    record.start = performance.now();
    record.duration = hero ? motion.heroDuration : motion.sectionDuration;
    const title = record.element.querySelector('h1, h2');
    animate(record, title, [
      { opacity: .08, transform: 'translateY(12px)', clipPath: 'inset(0 0 90% 0)' },
      { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0% 0)' },
    ], { duration: record.duration });
    if (hero) {
      animate(record, record.element.querySelector('.cat-stage'), [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 500, delay: 120 });
    } else {
      const items = record.element.querySelectorAll('.case-card, .steps li, .team-grid article');
      items.forEach((item, index) => animate(record, item, [
        { opacity: .25, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: motion.revealDuration, delay: index * motion.itemStagger }));
    }
    // A timer also settles the DOM if animation frames are throttled.
    record.timer = setTimeout(() => finish(record), record.duration + 60);
    scheduler.add(task);
  };
  const finishTarget = target => {
    const record = records.find(record => record.element === target || record.element.contains(target));
    if (record) finish(record);
    clear();
  };
  const hashTarget = () => {
    try {
      const id = decodeURIComponent(location.hash.slice(1));
      if (id) finishTarget(document.getElementById(id));
    } catch { /* A malformed hash must not affect the page. */ }
  };
  resizeCanvas();
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const record = records.find(record => record.element === entry.target);
      if (entry.isIntersecting) start(record);
      else if (record.state === 'active') finish(record);
    }
  }, { threshold: 0.04 });
  records.forEach(record => observer.observe(record.element));
  document.addEventListener('focusin', event => finishTarget(event.target));
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href^="#"]');
    if (link) {
      try { finishTarget(document.getElementById(decodeURIComponent(link.hash.slice(1)))); } catch { /* Native navigation is preserved. */ }
    }
  });
  window.addEventListener('hashchange', hashTarget);
  window.addEventListener('resize', () => {
    records.filter(record => record.state === 'active').forEach(finish);
    resizeCanvas();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) records.filter(record => record.state === 'active').forEach(finish);
  });
  window.addEventListener('pagehide', () => { records.forEach(finish); clear(); });
  hashTarget();
  if (!location.hash) start(records[0]);
  return {
    finishAll() { observer.disconnect(); records.forEach(finish); scheduler.remove(task); clear(); },
    records,
  };
}

export function enhanceDetails(reduced) {
  const animations = new Map();
  const settle = details => {
    const current = animations.get(details);
    if (!current) return;
    current.animation.cancel();
    details.open = current.open;
    details.style.removeProperty('overflow');
    animations.delete(details);
  };
  document.querySelectorAll('details').forEach(details => {
    const summary = details.querySelector('summary');
    summary.addEventListener('click', event => {
      if (reduced.matches || !details.animate) return;
      event.preventDefault();
      const from = details.getBoundingClientRect().height;
      const previous = animations.get(details);
      const open = previous ? !previous.open : !details.open;
      if (previous) { previous.animation.cancel(); animations.delete(details); }
      details.open = true;
      const to = open ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height + 2;
      details.style.overflow = 'clip';
      const animation = details.animate([{ height: `${from}px` }, { height: `${to}px` }], {
        duration: motion.detailsDuration,
        easing: 'cubic-bezier(.2,.75,.25,1)',
      });
      animations.set(details, { animation, open });
      animation.onfinish = () => settle(details);
    });
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) [...animations.keys()].forEach(settle);
  });
  window.addEventListener('pagehide', () => [...animations.keys()].forEach(settle));
}
