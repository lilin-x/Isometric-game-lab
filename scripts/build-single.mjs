// =============================================================
//  build-single.mjs — รวมเกมทั้งหมดเป็นไฟล์ HTML ไฟล์เดียว
//  ใช้หลัง `vite build`:  npm run build:single
//  ผลลัพธ์: dist-single/index.html (ส่งให้เพื่อนเปิดเล่นได้เลย ไม่ต้องมีเซิร์ฟเวอร์)
// =============================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');

// แทน <script src="..."> ด้วยโค้ดจริง
html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/g, (_, file) => {
  const js = readFileSync(join(dist, file), 'utf8').replace(/<\/script>/g, '<\\/script>');
  return `<script type="module">${js}</script>`;
});
// แทน <link rel="stylesheet" href="..."> ด้วย <style>
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/g, (_, file) => {
  return `<style>${readFileSync(join(dist, file), 'utf8')}</style>`;
});

mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/index.html', html);
console.log(`dist-single/index.html (${(html.length / 1024).toFixed(0)} KB)`);
