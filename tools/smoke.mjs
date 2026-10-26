// End-to-end check: home page -> make a cartoon -> play it, saving frames along the way.
//   node tools/smoke.mjs [outDir] [placeId] [castIds]
import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.resolve(process.argv[2] || path.join(root, 'out/smoke')); fs.mkdirSync(out, { recursive: true });
const place = process.argv[3] || 'park', cast = (process.argv[4] || 'maya,leo,zara').split(',');
const PORT = 8098, server = spawn(process.execPath, [path.join(root, 'server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'inherit', 'inherit'] });
await new Promise(r => setTimeout(r, 1200));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`http://localhost:${PORT}/`);
  await page.evaluate((place, cast) => { localStorage.setItem('storybuddy.pick', JSON.stringify({ cast, place, story: 'kite', placeText: '', storyText: '' })); localStorage.setItem('storybuddy.voice', JSON.stringify(process?.env?.VOICE || 'browser')); }, place, cast).catch(() => {});
  await page.evaluate((v) => localStorage.setItem('storybuddy.voice', JSON.stringify(v)), process.env.VOICE || 'browser');
  await page.reload(); await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(out, '0-home.jpg'), type: 'jpeg', quality: 80, fullPage: true });
  await page.click('#go');
  await page.waitForSelector('#start.show, #loading.error', { timeout: 300000 });
  if (await page.$('#loading.error')) { console.log('ERROR:', await page.$eval('#status', e => e.textContent)); process.exitCode = 1; }
  else {
    await page.screenshot({ path: path.join(out, '1-start.jpg'), type: 'jpeg', quality: 82 });
    await page.click('#play');
    for (let i = 0; i < 16; i++) {
      await new Promise(r => setTimeout(r, 2500));
      await page.screenshot({ path: path.join(out, `2-play-${String(i).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 82 });
      if (await page.$('#end.show')) { console.log('ended at frame', i); break; }
    }
  }
} finally { await browser.close(); server.kill(); }
