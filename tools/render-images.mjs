// Renders the home page images from the real rig: preset character thumbnails and the hero shot.
//   node tools/render-images.mjs        (needs Chrome installed; starts its own server)
import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { CHARACTERS } from '../public/js/presets.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 8099, server = spawn(process.execPath, [path.join(root, 'server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.goto(`http://localhost:${PORT}/_thumbs.html`);
  await page.waitForFunction('window.ready', { timeout: 120000 });
  const el = await page.$('#c');
  for (const c of CHARACTERS) {
    await page.evaluate((id) => window.render('char', id), c.id);
    await el.screenshot({ path: path.join(root, 'public/img/chars', c.id + '.jpg'), type: 'jpeg', quality: 86, clip: { x: 350, y: 50, width: 900, height: 900 } });
    console.log('char', c.id);
  }
  await page.evaluate(() => window.render('hero'));
  await el.screenshot({ path: path.join(root, 'public/img/hero.jpg'), type: 'jpeg', quality: 86 });
  console.log('hero');
} finally { await browser.close(); server.kill(); }
