import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHandler } from '../server.mjs';

test('Matrix variant shares content but isolates its route, boot and motion assets', async t => {
 const server=createServer(createHandler({publicWorks(){throw new Error('offline');}}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const response=await fetch(origin+'/ai-code-matrix');
 assert.equal(response.status,200);
 assert.doesNotMatch(response.headers.get('content-security-policy'),/unsafe-inline|unsafe-eval/);
 const html=await response.text();
 assert.match(html, /rel="canonical" href="https:\/\/talyutin.ru\/ai-code-matrix"/);
 assert.match(html, /src="\/ai-code-matrix\/main.js"/);
 assert.doesNotMatch(html, /src="\/ai-code\/main.js"/);
 assert.match(html, /Еремин Илья Алексеевич/);
 assert.equal((html.match(/class="case-card"/g)||[]).length,2);
 assert.match(html, /content="https:\/\/talyutin.ru\/ai-code\/social-preview.png"/);
 for(const asset of ['boot.js','main.js','particles.js','styles.css']) assert.equal((await fetch(origin+'/ai-code-matrix/'+asset)).status,200);
 for(const path of ['/ai-code-matrix/','/ai-code-matrix/index.html']) {
  const redirect=await fetch(origin+path,{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/ai-code-matrix');
 }
 assert.equal((await fetch(origin+'/ai-code-matrix/missing.js')).status,404);
 assert.equal((await fetch(origin+'/ai-code-matrix',{method:'POST'})).status,405);
 const normal=await (await fetch(origin+'/ai-code')).text();
 assert.doesNotMatch(normal,/matrix-controls|ai-code-matrix/);
 assert.match(normal,/src="\/ai-code\/main.js"/);
});

test('captured code drops enter from above and keep their vertical trajectory and identity', async () => {
 const {dropPosition}=await import('../public/ai-code-matrix/particles.js');
 const drop={id:7,x:102,from:-18,speed:.5,born:100,target:{x:104,y:200,letter:'カ'}};
 assert.equal(dropPosition(drop,99),null);
 assert.deepEqual(dropPosition(drop,100),{x:102,y:-18,captured:false});
 let previous=-Infinity;
 for(let time=100;time<700;time++) {
  const point=dropPosition(drop,time);
  assert.ok(point.y>=previous && point.y<=200);
  if(point.y<182)assert.equal(point.x,102);
  previous=point.y;
 }
 assert.deepEqual(dropPosition(drop,536),{x:104,y:200,captured:true});
 assert.deepEqual(dropPosition(drop,1000),dropPosition(drop,536));
 assert.equal(drop.id,7);assert.equal(drop.target.letter,'カ');
});
