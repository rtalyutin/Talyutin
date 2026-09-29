    const options={teams:[8,16],venues:[1,2],duration:[45,60]};
    const defaults={teams:8,venues:1,duration:45};
    let saved;
    try{saved=JSON.parse(document.getElementById('state').textContent)}catch{saved=defaults}
    const query=new URLSearchParams(location.search);
    const embedded=query.has('embedded');
    if(embedded)document.body.classList.add('embedded');
    const state={};
    for(const key of Object.keys(options)){
      const fromUrl=Number(query.get(key));
      state[key]=options[key].includes(fromUrl)?fromUrl:options[key].includes(saved[key])?saved[key]:defaults[key];
    }
    const roundLabels={3:['Четвертьфинал','Полуфинал','Финал'],4:['1/8 финала','Четвертьфинал','Полуфинал','Финал']};
    const pad=n=>String(n).padStart(2,'0');
    function time(minutes){const day=Math.floor(minutes/1440);const local=minutes%1440;return `${pad(Math.floor(local/60))}:${pad(local%60)}${day?` +${day} день`:''}`}
    function calculate(){
      const rounds=Math.log2(state.teams),rows=[];
      let start=600,number=1,previous=[];
      for(let round=0;round<rounds;round++){
        const count=state.teams/2**(round+1),current=[];
        for(let i=0;i<count;i++){
          const slot=Math.floor(i/state.venues),begins=start+slot*(state.duration+15),ends=begins+state.duration;
          const pair=round===0?`Команда ${i*2+1} — Команда ${i*2+2}`:`Победитель М${previous[i*2]} — М${previous[i*2+1]}`;
          rows.push({number,round:roundLabels[rounds][round],begins,ends,venue:i%state.venues+1,pair});
          current.push(number++);
        }
        previous=current;
        start+=Math.ceil(count/state.venues)*(state.duration+15);
      }
      return rows;
    }
    let rows=[];
    function render(){
      for(const key of Object.keys(options))for(const button of document.querySelectorAll(`#${key} button`))button.setAttribute('aria-pressed',Number(button.dataset.value)===state[key]?'true':'false');
      rows=calculate();
      const tbody=document.getElementById('schedule-body');
      tbody.replaceChildren(...rows.map(row=>{
        const tr=document.createElement('tr');
        for(const content of [`${time(row.begins)} — ${time(row.ends)}`,`Площадка ${row.venue}`,`М${row.number}`,row.pair]){
          const td=document.createElement('td');td.textContent=content;tr.appendChild(td);
        }
        const label=document.createElement('span');label.className='round';label.textContent=row.round;tr.children[2].prepend(label);
        return tr;
      }));
      const end=rows.at(-1).ends;
      document.getElementById('summary').textContent=`${rows.length} матчей · конец ${time(end)}`;
      document.getElementById('notice').textContent=end>=1440?'Расчёт выходит за пределы суток. Добавьте площадку или сократите длительность матча.':'';
      document.getElementById('state').textContent=JSON.stringify(state);
      if(embedded&&window.parent!==window)window.parent.postMessage({type:'planner-state',...state},location.origin);
    }
    for(const key of Object.keys(options))document.getElementById(key).addEventListener('click',event=>{
      const button=event.target.closest('button[data-value]');if(!button)return;
      state[key]=Number(button.dataset.value);render();
    });
    function download(name,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
    document.getElementById('download-csv').addEventListener('click',()=>{
      const quote=value=>`"${String(value).replaceAll('"','""')}"`;
      const lines=[['Раунд','Матч','Начало','Конец','Площадка','Пара'],...rows.map(r=>[r.round,`М${r.number}`,time(r.begins),time(r.ends),r.venue,r.pair])];
      download('turnirnyj-den.csv','\ufeff'+lines.map(row=>row.map(quote).join(';')).join('\r\n'),'text/csv;charset=utf-8');
    });
    document.getElementById('reset').addEventListener('click',()=>{
      Object.assign(state,defaults);render();
      window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    });
    async function sourceText(node){
      if(!node.hasAttribute('src')&&!node.hasAttribute('href'))return node.textContent;
      const response=await fetch(node.src||node.href);
      if(!response.ok)throw new Error('Cannot bundle planner');
      return response.text();
    }
    document.getElementById('download-tool').addEventListener('click',async()=>{
      try{
        const [css,js]=await Promise.all([sourceText(document.getElementById('tool-style')),sourceText(document.getElementById('tool-runtime'))]);
        const copy=document.documentElement.cloneNode(true);
        copy.querySelector('body').classList.remove('embedded');
        copy.querySelector('.origin')?.remove();
        copy.querySelector('#state').textContent=JSON.stringify(state);
        const style=document.createElement('style');style.id='tool-style';style.textContent=css;
        copy.querySelector('#tool-style').replaceWith(style);
        const script=document.createElement('script');script.id='tool-runtime';script.textContent=js;
        copy.querySelector('#tool-runtime').replaceWith(script);
        download('turnirnyj-den.html','<!doctype html>\n'+copy.outerHTML,'text/html;charset=utf-8');
      }catch{
        document.getElementById('notice').textContent='Не удалось собрать автономный файл. Попробуйте ещё раз.';
      }
    });
    render();
