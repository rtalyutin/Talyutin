// Independent of WebGL and the animation module, including reduced-motion mode.
(() => {
  const root=document.documentElement;
  const button=document.querySelector('#matrix-theme-toggle');
  const bar=document.querySelector('.matrix-theme-bar');
  if(!button||!bar)return;
  function apply(theme,notify=true) {
    const dark=theme==='dark';
    root.dataset.matrixTheme=dark?'dark':'light';
    button.setAttribute('aria-pressed',String(dark));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#06100b':'#ffffff');
    if(notify)document.dispatchEvent(new CustomEvent('matrix-themechange'));
  }
  apply(root.dataset.matrixTheme,false);
  bar.hidden=false;
  button.addEventListener('click',()=>{
    const theme=root.dataset.matrixTheme==='dark'?'light':'dark';
    apply(theme);
    try{localStorage.setItem('iikot-matrix-theme',theme);}catch{/* Theme works when storage is blocked. */}
  });
  window.addEventListener('storage',event=>{
    if(event.key==='iikot-matrix-theme'||event.key===null)apply(event.newValue==='dark'?'dark':'light');
  });
})();
