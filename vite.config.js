import { defineConfig } from 'vite';

// base: './' ทำให้ไฟล์ที่ build ออกมา (โฟลเดอร์ dist/) เปิดจาก path ไหนก็ได้
// เช่น GitHub Pages หรือโฟลเดอร์ย่อยบนเว็บเซิร์ฟเวอร์
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { chunkSizeWarningLimit: 1500 },
});
