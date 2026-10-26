// Paints the creator wardrobe (wardrobe.js) in headless Chrome -> creator/tex/*.png + meta.json
//   node bake.mjs [name,name,...]
import http from 'http'; import fs from 'fs'; import path from 'path'; import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), CREATOR = path.dirname(HERE), ROOT = path.dirname(CREATOR);
const require = createRequire(path.join(ROOT, 'tools/package.json'));
const puppeteer = require('puppeteer-core');
const server = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(0);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => console.log('[page]', m.text()));
await p.goto(`http://localhost:${server.address().port}/creator/paint/paint.html`); await p.waitForFunction('window.ready');
const only = process.argv[2] ? process.argv[2].split(',') : null, t0 = Date.now();
const res = await p.evaluate(o => window.bake(o), only);
const dir = path.join(CREATOR, 'tex'); fs.mkdirSync(dir, { recursive: true });
const metaF = path.join(dir, 'meta.json'), meta = fs.existsSync(metaF) && only ? JSON.parse(fs.readFileSync(metaF)) : {};
for (const [k, v] of Object.entries(res)) {
  fs.writeFileSync(path.join(dir, k + '.png'), Buffer.from(v.png.split(',')[1], 'base64')); meta[k] = { box: v.box, D: v.D, w: v.w, h: v.h, nrm: !!v.nrm };
  if (v.nrm) fs.writeFileSync(path.join(dir, k + '_n.png'), Buffer.from(v.nrm.split(',')[1], 'base64'));
}
fs.writeFileSync(metaF, JSON.stringify(meta));
console.log('baked', Object.keys(res).length, 'textures in', Date.now() - t0, 'ms');
await b.close(); server.close();
