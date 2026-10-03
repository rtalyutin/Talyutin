import { build } from 'esbuild';
import { resolve } from 'node:path';
import { appendFileSync, readFileSync } from 'node:fs';
await build({
  entryPoints: [resolve(import.meta.dirname, '../client/phone-viewer.js')],
  outfile: resolve(import.meta.dirname, '../public/phone-viewer.js'),
  bundle: true, format: 'esm', target: ['es2022'], minify: true,
  legalComments: 'linked',
});

appendFileSync(resolve(import.meta.dirname, '../public/phone-viewer.js.LEGAL.txt'),
  '\n' + readFileSync(resolve(import.meta.dirname, '../node_modules/three/LICENSE'), 'utf8'));