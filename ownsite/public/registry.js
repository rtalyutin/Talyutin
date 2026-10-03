const families = Object.freeze({
  ycs: 'arena', stories: 'stories', booking: 'booking', winline: 'data',
  tochki: 'dots', wildberries: 'shelf', dashboard: 'map',
  'sparrow-webmcp': 'tools', 'postgres-audit': 'database'
});

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function art(family, index) {
  const gridId = `ticket-grid-${index}`;
  const tornDark = '<path d="M68 17L126 11 153 19 192 10 236 17 273 9 309 16 366 11 418 19 469 12 526 19 558 12 568 54 558 88 570 115 561 160 570 207 509 214 465 207 415 218 360 211 319 219 269 211 228 218 186 210 145 217 105 211 73 218 83 175 70 140 81 103 70 65Z" fill="#171918"/>';
  const redPaper = '<path d="M7 30L61 17 104 27 149 14 182 27 214 20 221 61 209 107 224 151 216 203 167 214 133 204 96 216 56 208 12 217 21 174 9 133 19 99 5 64Z" fill="#e53327"/>';
  const backdrop = `<rect width="600" height="230" fill="#eee8dc"/>${tornDark}`;
  let drawing;
  switch (family) {
    case 'arena':
      drawing = `${redPaper}<g fill="none" stroke="#ede6d7" stroke-width="2"><path d="M245 48h46v29h-46zM245 152h46v29h-46zM506 48h46v29h-46zM506 152h46v29h-46z"/><path d="M291 63h39v43h32M291 167h39v-43h32M506 63h-40v43h-31M506 167h-40v-43h-31"/></g><g fill="none" stroke="#ed3429" stroke-width="3"><path d="M374 84h49l-4 24c-2 17-9 26-20 26s-20-9-23-26zM373 90h-14v12c0 12 7 20 18 20M424 90h14v12c0 12-7 20-18 20M399 135v20M383 159h32"/></g><g fill="#f7f2e7"><path d="M43 76h91v7H43zM43 99h112v7H43zM43 122h77v7H43z"/></g>`;
      break;
    case 'stories':
      drawing = '<path d="M49 37L215 20 241 208 67 223Z" fill="#bd3026"/><path d="M88 21L261 29 251 215 77 207Z" fill="#dc4c3d"/><path d="M143 36L322 18 341 201 155 222Z" fill="#ded4c1"/><g stroke="#a99d88" stroke-width="2"><path d="M169 69l119-12M172 84l116-12M177 99l116-12M179 115l117-12M183 130l89-10"/></g><path d="M302 12L552 30 540 218 283 198Z" fill="#f4efdf"/><circle cx="482" cy="69" r="32" fill="#e53327"/><path d="M304 193l50-38 20-49 17 40 27-10 10-62 13 49 23-27 17 63 18-24 21 37 28 17z" fill="#171918"/><path d="M356 154v-27h17v35M420 150v-20h20v34M466 173v-27h18v38" fill="#171918"/>';
      break;
    case 'booking': {
      const cells = Array.from({length: 28}, (_, cell) => `<text x="${226 + (cell % 7) * 43}" y="${88 + Math.floor(cell / 7) * 33}" text-anchor="middle" font-size="12" fill="#827d72">${cell + 1}</text>`).join('');
      drawing = `${redPaper}<path d="M194 12L552 32 542 219 170 198Z" fill="#f8f4e9"/><g transform="rotate(3 360 115)"><path d="M204 62h337M204 96h337M204 129h337M204 162h337M204 195h337M247 62v133M290 62v133M333 62v133M376 62v133M419 62v133M462 62v133M505 62v133" fill="none" stroke="#d1c7b5"/><rect x="355" y="102" width="43" height="27" fill="#e53327"/>${cells}<path d="M218 8v28M263 11v28M308 14v28M353 17v28M398 20v28M443 23v28M488 26v28M533 29v28" stroke="#171918" stroke-width="7" stroke-linecap="round"/></g>`;
      break;
    }
    case 'data':
      drawing = `${redPaper}<g transform="rotate(-7 344 114)"><rect x="144" y="35" width="387" height="171" rx="2" fill="#272b29" stroke="#7b7d74"/><path d="M144 64h387" stroke="#84857c"/><circle cx="161" cy="49" r="3" fill="#e53327"/><circle cx="174" cy="49" r="3" fill="#bbb5a7"/><circle cx="187" cy="49" r="3" fill="#bbb5a7"/><path d="M170 89h124M170 103h178M170 117h97M170 131h140M170 164h49M170 178h72" stroke="#d8d2c5" stroke-width="3"/><g fill="#9b9f94"><path d="M343 159h17v26h-17zM369 137h17v48h-17zM395 147h17v38h-17zM421 116h17v69h-17zM447 93h17v92h-17z"/></g><path d="M473 79h17v106h-17z" fill="#e53327"/><circle cx="503" cy="93" r="11" fill="#e53327"/></g>`;
      break;
    case 'dots':
      drawing = `${redPaper}<defs><pattern id="${gridId}" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="#c6bca8" stroke-width="1"/></pattern><pattern id="${gridId}-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(25)"><path d="M0 0v6" stroke="#e53327" stroke-width="1"/></pattern></defs><g transform="rotate(-8 378 112)"><path d="M214 0h335v230H214z" fill="#f3eddd"/><path d="M214 0h335v230H214z" fill="url(#${gridId})"/><path d="M316 76L384 76 384 144 316 144Z" fill="url(#${gridId}-hatch)" stroke="#d7382b" stroke-width="3"/><g fill="#171918"><circle cx="282" cy="42" r="6"/><circle cx="316" cy="76" r="6"/><circle cx="384" cy="76" r="6"/><circle cx="350" cy="178" r="6"/><circle cx="418" cy="144" r="6"/><circle cx="248" cy="110" r="6"/></g><g fill="#e53327"><circle cx="316" cy="144" r="6"/><circle cx="384" cy="144" r="6"/><circle cx="418" cy="42" r="6"/><circle cx="452" cy="110" r="6"/><circle cx="282" cy="178" r="6"/></g></g>`;
      break;
    case 'shelf':
      drawing = `${redPaper}<path d="M117 14l423 9-4 197-418-6Z" fill="#e9e1d2"/><path d="M128 135L433 91 465 112 157 160Z" fill="#bea383"/><path d="M157 160l308-48v14l-308 48Z" fill="#8a7054"/><path d="M165 173v34l14-2v-34M402 136v35l14-2v-35" fill="#242724"/><path d="M127 135l30 25v14l-30-25Z" fill="#a08465"/><g fill="#f7f2e8" stroke="#d3c7b5" stroke-width="2"><path d="M466 19h114v79H466zM470 122h112v86H470z"/></g><path d="M481 49h78l12 10h-78zM486 162h74l10 10h-74z" fill="#b79c7b"/><path d="M493 59v20M555 59v20M497 172v20M555 172v20" stroke="#242724" stroke-width="5"/>`;
      break;
    case 'map':
      drawing = '<path d="M34 12l538 9-4 197-528 9Z" fill="#1c201e"/><g fill="none" stroke="#c9c2b4" stroke-width="2"><path d="M115 83h131v33h139M246 99v83h137M385 99h98M448 99v-42"/></g><g fill="#eae2d1" stroke="#b4aa94" stroke-width="2"><path d="M36 46h134v65H36zM363 41h170v80H363zM112 147h162v61H112zM397 152h144v63H397z"/></g><g fill="#9a927f"><path d="M53 66h81v3H53zM53 79h98v3H53zM53 92h59v3H53zM382 63h116v3H382zM382 78h82v3H382zM382 93h102v3H382zM129 166h99v3h-99zM129 181h111v3H129zM414 171h99v3h-99zM414 185h76v3h-76z"/></g><path d="M204 36l136-11 7 87-138 8Z" fill="#e53327"/><path d="M226 57l89-6M227 72l92-6M229 87l59-4" stroke="#f5e6d9" stroke-width="3"/>';
      break;
    case 'tools':
      drawing = `${redPaper}<path d="M338 18L584 31 573 215 332 209Z" fill="#e53327"/><g transform="rotate(7 305 110)"><rect x="116" y="57" width="368" height="93" rx="7" fill="#f8f2e6" stroke="#ccc3b2" stroke-width="2"/><path d="M177 91c-19-26-45 3-16 12h30c29 9 3 38-16 12V87c-9-29-38-3-12 16h28c26 19 0 45-12 15z" fill="none" stroke="#1e211d" stroke-width="4"/><path d="M234 86h124M234 104h154M234 122h101" stroke="#5a5d53" stroke-width="4"/><path d="M413 84l12 12-12 12M447 84l-12 12 12 12" fill="none" stroke="#e53327" stroke-width="4"/></g><path d="M309 115l14 89 19-25 27-1Z" fill="#141816" stroke="#f9f4e8" stroke-width="3"/>`;
      break;
    case 'database':
      drawing = '<path d="M45 12h292l-6 206H31Z" fill="#1b1e1a"/><g stroke="#a8a595" stroke-width="2"><path d="M107 62v107c0 16 93 16 93 0V62" fill="#55594d"/><path d="M107 86c0 20 93 20 93 0M107 118c0 20 93 20 93 0M107 148c0 20 93 20 93 0" fill="none"/><ellipse cx="153" cy="62" rx="46" ry="17" fill="#292e25"/></g><path d="M286 21l281 17-9 177-280-14Z" fill="#f4edde"/><g transform="rotate(4 420 120)"><path d="M313 72h214M313 56h127" stroke="#c3b8a4" stroke-width="3"/><path d="M334 163h21v22h-21zM370 144h21v41h-21zM406 128h21v57h-21z" fill="#242722"/><path d="M442 103h21v82h-21zM478 82h21v103h-21z" fill="#e53327"/></g>';
      break;
    default:
      drawing = `${redPaper}<g fill="none" stroke="#e7dfce" stroke-width="3"><path d="M240 70h58v58h-58zM433 70h58v58h-58zM336 144h58v58h-58zM298 100h66v44M364 100h69M364 144v-44"/></g><circle cx="363" cy="100" r="12" fill="#e53327"/>`;
  }
  return `<svg class="ticket-art" viewBox="0 0 600 230" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${backdrop}${drawing}</svg>`;
}

/** Shared SSR/client rendering. Call only with the already filtered public list. */
export function renderCatalogue(works, selectedSlug = '') {
  if (!Array.isArray(works)) return '';
  return works.map((work, index) => {
    const slug = String(work.slug ?? '');
    const family = Object.hasOwn(families, slug) ? families[slug] : 'generic';
    const selected = slug === selectedSlug;
    const href = `/?work=${encodeURIComponent(slug)}&mode=reveal#manifesto`;
    return `<article class="work-row paper-ticket ticket-family-${family}${selected ? ' is-selected' : ''}" data-ticket="${escapeHtml(slug)}">
      <a class="ticket-link" href="${escapeHtml(href)}" data-work="${escapeHtml(slug)}" data-target-mode="reveal" aria-label="${escapeHtml(`Раскрыть работу: ${work.title ?? ''}`)}"${selected ? ' aria-current="true"' : ''}>
        <div class="ticket-thumbnail" aria-hidden="true"><span class="ticket-number">${String(index + 1).padStart(2, '0')}</span>${art(family, index)}</div>
        <div class="ticket-body"><h3 class="ticket-title">${escapeHtml(work.title)}</h3><p class="ticket-category">${escapeHtml(work.category)}</p><span class="ticket-action">Раскрыть работу <span class="arrow" aria-hidden="true">↗</span></span></div>
        <span class="ticket-tab" aria-hidden="true"></span>
      </a>
    </article>`;
  }).join('');
}
