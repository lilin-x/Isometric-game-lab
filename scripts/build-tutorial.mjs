// =============================================================
//  build-tutorial.mjs — แปลง docs/tutorial.html เป็นหน้าเว็บไฟล์เดียว
//  (ฝังรูปเป็น data URI และตัดโครง <html>/<head>/<body> ออก
//   เพราะระบบเผยแพร่บน claude.ai จะใส่โครงให้เอง)
//  npm run build:tutorial  →  dist-artifact/tutorial.html
// =============================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

let html = readFileSync('docs/tutorial.html', 'utf8');
html = html.replace(/src="img\/([^"]+\.jpg)"/g, (_, f) => `src="data:image/jpeg;base64,${readFileSync('docs/img/' + f).toString('base64')}"`);
// ในหน้าที่เผยแพร่ ปุ่ม "เล่นเกม" ชี้ไปที่หน้าเกมที่เผยแพร่แล้ว (ในโปรเจกต์ชี้ไป ../index.html)
const GAME_URL = process.env.GAME_URL || 'https://claude.ai/artifact/DaEv1pxh9XMaRt6amZp6sh';
html = html.replace('href="../index.html"', `href="${GAME_URL}"`);
html = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '')
  .replace(/<\/body>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
mkdirSync('dist-artifact', { recursive: true });
writeFileSync('dist-artifact/tutorial.html', html);
console.log(`dist-artifact/tutorial.html (${(html.length / 1024).toFixed(0)} KB)`);
