import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { openRemotePortfolio } from '../remote-db.mjs';
import { createHandler } from '../server.mjs';

test('PostgreSQL constructor → mounted Tg-mcp HTTP → frontend SSR and revocation', {
  skip: !process.env.TG_MCP_DIRECTORY ? 'TG_MCP_DIRECTORY points to a local Tg-mcp checkout for cross-repository verification' : false,
}, async t => {
  const root = resolve(process.env.TG_MCP_DIRECTORY);
  const require = createRequire(resolve(root,'package.json'));
  const { PGlite } = require('@electric-sql/pglite');
  const { createOwnsiteGateway } = await import(pathToFileURL(resolve(root,'src/ownsite/gateway.ts')));
  const { startLocalOutreach } = await import(pathToFileURL(resolve(root,'src/outreach/server.ts')));
  const db = new PGlite();
  t.after(()=>db.close());
  const query = async (sql,params) => { const r = await db.query(sql,params); return {...r,rowCount:r.affectedRows ?? r.rows.length}; };
  const pool = {query,connect:async()=>({query,release(){}})};
  const owner = '14a4d6e9-63b0-44ea-9f45-a6237692aef1';
  const ownsite = await createOwnsiteGateway(pool,owner,{phone:undefined,email:undefined});
  const backend = await startLocalOutreach({pool,ownsite});
  t.after(()=>backend.close());
  const remote = openRemotePortfolio(backend.url+'/ownsite',{allowLoopback:true});
  const frontend = createServer(createHandler(remote));
  await new Promise(resolve=>frontend.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>frontend.close(resolve)));
  const origin = `http://127.0.0.1:${frontend.address().port}`;
  assert.deepEqual((await (await fetch(origin+'/api/works')).json()).map(row=>row.slug),['ycs','dashboard']);
  let page = await fetch(origin+'/?work=ycs');
  assert.equal(page.status,200);
  let html = await page.text();
  assert.match(html,/ЯрКиберСезон/);assert.match(html,/tel:\+79065253445/);assert.match(html,/mailto:info@yarcyberseason.ru/);
  assert.doesNotMatch(html,/\{\{[A-Z_]+\}\}|Недетские сказки/);
  await ownsite.callTool('ownsite_update_work',{id:'ycs',patch:{show:false,summary:'PRIVATE MARKER'}},owner);
  for (const path of ['/api/works/ycs','/assets/ycs-backdrop.jpg','/tool.html']) assert.equal((await fetch(origin+path)).status,404);
  html = await (await fetch(origin+'/?work=ycs&mode=reveal')).text();
  assert.doesNotMatch(html,/PRIVATE MARKER|ycs-backdrop\.jpg/);
  await createOwnsiteGateway(pool,owner);
  assert.equal(await ownsite.publicWork('ycs'),null);
  await backend.close();
  assert.equal((await fetch(origin+'/healthz')).status,200);
  assert.equal((await fetch(origin+'/readyz')).status,503);
  page = await fetch(origin+'/');assert.equal(page.status,503);
  assert.equal(await page.text(),'Service unavailable');
});
