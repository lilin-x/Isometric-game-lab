import { defineConfig } from 'vite';

// base: './' ทำให้ไฟล์ที่ build ออกมา (โฟลเดอร์ dist/) เปิดจาก path ไหนก็ได้
// เช่น GitHub Pages หรือโฟลเดอร์ย่อยบนเว็บเซิร์ฟเวอร์
//
// โหมด ARTIFACT=1 (ใช้โดย scripts/build-artifact.mjs):
//   ไม่รวม three.js เข้าไปในไฟล์ แต่ให้โหลดจาก CDN แทน (ผ่าน importmap)
export default defineConfig(() => {
  const artifact = !!process.env.ARTIFACT;
  return {
    base: './',
    server: { host: true, port: 5173 },
    build: {
      chunkSizeWarningLimit: 1500,
      outDir: artifact ? 'dist-artifact' : 'dist',
      minify: !artifact,
      rollupOptions: artifact ? { external: ['three', /^three\/addons\//] } : {},
    },
  };
});
