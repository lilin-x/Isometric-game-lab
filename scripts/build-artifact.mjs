// =============================================================
//  build-artifact.mjs — สร้างหน้าเว็บไฟล์เดียวที่โหลด three.js จาก CDN
//  (ใช้เผยแพร่เกมเป็นหน้าเว็บบน claude.ai)
//  npm run build:artifact  →  dist-artifact/red-scarf.html
// =============================================================

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.186.0';

execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, ARTIFACT: '1' } });

const out = 'dist-artifact';
const assets = readdirSync(join(out, 'assets'));
const js = readFileSync(join(out, 'assets', assets.find((f) => f.endsWith('.js'))), 'utf8').replace(/<\/script>/g, '<\\/script>');
const css = readFileSync(join(out, 'assets', assets.find((f) => f.endsWith('.css'))), 'utf8');
const src = readFileSync('index.html', 'utf8');
const body = src.slice(src.indexOf('<div id="app">'), src.lastIndexOf('<script'));
const fonts = src.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]+>/)[0];

const page = `<title>Red Scarf Adventure</title>
${fonts}
<style>:root{color-scheme:dark}${css}</style>
<script type="importmap">{"imports":{"three":"${THREE_CDN}/build/three.module.js","three/addons/":"${THREE_CDN}/examples/jsm/"}}</script>
${body.trim()}
<script type="module">
${js}
</script>
`;
writeFileSync(join(out, 'red-scarf.html'), page);
console.log(`${out}/red-scarf.html (${(page.length / 1024).toFixed(0)} KB)`);
