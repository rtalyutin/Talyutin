// Enhance the complete no-JS copy with independently expandable short lists.
// Without JavaScript the complete copy remains available.
export function enhanceFounders() {
  for (const experience of document.querySelectorAll('.founder-experience')) {
    const list = experience.querySelector('p');
    const button = experience.querySelector('button');
    const full = list.textContent;
    list.textContent = list.dataset.short;
    button.setAttribute('aria-expanded', 'false');
    button.replaceChildren(document.createTextNode('Весь опыт +'));
    button.hidden = false;
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      list.textContent = expanded ? full : list.dataset.short;
      button.setAttribute('aria-expanded', String(expanded));
      button.replaceChildren(document.createTextNode(expanded ? 'Свернуть ' : 'Весь опыт '));
      const indicator = document.createElement('span');
      indicator.setAttribute('aria-hidden', 'true');
      indicator.textContent = expanded ? '−' : '+';
      button.append(indicator);
    });
  }
}
