# Research notes (แหล่งอ้างอิงที่ใช้ทำเกมและหน้าสอน)

> สรุปจากการค้นคว้าก่อนเริ่มทำโปรเจกต์ (พ.ย. 2026, three.js r187)

## 1. กล้อง Isometric
- วางกล้องที่ `(d, d, d)` แล้ว `lookAt(0,0,0)` → pitch = atan(1/√2) ≈ 35.264°, yaw = 45° (true isometric)
- "2:1 isometric" แบบ pixel art จริงๆ คือ dimetric (~26.565°) — ในเกม 3D ใช้มุมไหนก็ได้ตามชอบ
- OrthographicCamera ไม่มี `aspect` → ตอน resize ให้คำนวณ left/right/top/bottom ใหม่จากความสูงคงที่ แล้ว `updateProjectionMatrix()`
- WASD แบบอิงหน้าจอ: กล้องที่ (+d,+d,+d) → W = (−0.707, 0, −0.707), D = (0.707, 0, −0.707)
- อ้างอิง: https://en.wikipedia.org/wiki/Isometric_video_game_graphics · https://github.com/mrdoob/three.js/blob/dev/manual/pages/cameras.html · https://github.com/mrdoob/three.js/blob/dev/manual/pages/responsive.html

## 2. ลุค Low poly + ประสิทธิภาพ
- `flatShading: true` ใช้ได้กับ MeshStandard/Lambert/Phong
- ใช้ palette สีจำกัด, HemisphereLight + DirectionalLight (เงาดวงเดียว), Fog
- Bloom: EffectComposer → RenderPass → UnrealBloomPass → OutputPass (ตัวสุดท้าย); ตั้ง threshold สูง + emissiveIntensity > 1 ให้เฉพาะโคมไฟเรือง (เทคนิคจากชุมชน)
- ลด draw call: `InstancedMesh`, `BufferGeometryUtils.mergeGeometries`; ดูจำนวนด้วย `renderer.info.render.calls`
- อ้างอิง: https://github.com/mrdoob/three.js/blob/dev/manual/pages/optimize-lots-of-objects.html · https://github.com/mrdoob/three.js/blob/dev/manual/pages/shadows.html · https://github.com/mrdoob/three.js/blob/dev/manual/pages/lights.html · https://github.com/mrdoob/three.js/blob/dev/manual/pages/fog.html · https://github.com/mrdoob/three.js/blob/dev/examples/webgl_postprocessing_unreal_bloom_selective.html

## 3. สิ่งที่เปลี่ยนใน three.js r170–r187
- `THREE.Clock` deprecated (r183) → ใช้ `THREE.Timer` (`timer.update(timestamp)` ทุกเฟรม, `getDelta()`, `connect(document)`)
- import addons: `three/addons/...`
- ค่าเริ่มต้น: outputColorSpace = SRGB, toneMapping = None; ถ้าใช้ composer ให้ OutputPass ทำ tone mapping
- `PCFSoftShadowMap` deprecated → ใช้ `PCFShadowMap` (ซึ่งนุ่มแล้ว)
- อ้างอิง: https://github.com/mrdoob/three.js/wiki/Migration-Guide · https://github.com/mrdoob/three.js/releases/tag/r187 · https://github.com/mrdoob/three.js/blob/dev/manual/pages/color-management.html

## 4. Game loop
- `requestAnimationFrame` / `renderer.setAnimationLoop`, clamp dt (manual ใช้ 1/20 s)
- Fixed timestep: accumulator + `update(STEP)`; clamp frame time กัน spiral of death
- อ้างอิง: https://github.com/mrdoob/three.js/blob/dev/manual/pages/game.html · https://developer.mozilla.org/en-US/docs/Games/Anatomy · https://gafferongames.com/post/fix_your_timestep/ · https://gameprogrammingpatterns.com/game-loop.html · https://gameprogrammingpatterns.com/update-method.html · https://gameprogrammingpatterns.com/component.html

## 5. State machine
- state = object { enter, update, exit }; three.js manual "Making a Game" มีตัวอย่าง FiniteStateMachine
- Nystrom: flag หลายตัว → บั๊ก; ใช้ state เดียวแก้ได้
- ศัตรู: idle → chase → windup (telegraph) → attack → recover → chase; ใช้ระยะ 2 ค่า (hysteresis) กันสลับไปมา
- อ้างอิง: https://gameprogrammingpatterns.com/state.html · https://abratabia.com/phaser/ai-enemies.php

## 6. Game feel / juice
- Hitstop (หยุดภาพสั้นๆ ตอนโดน), screen shake แบบ trauma² , knockback, flash, damage numbers, telegraph
- อ้างอิง: Sakurai "Stop for Big Moments!" https://www.youtube.com/watch?v=OdVkEOzdCPw · https://www.ssbwiki.com/Hitlag · Vlambeer "The Art of Screenshake" https://www.youtube.com/watch?v=AJdEqssNZ-U · "Juice it or Lose it" https://www.gdcvault.com/play/1016487/juice-it-or-lose · GMTK https://www.youtube.com/watch?v=216_5nu4aVQ · Eiserloh "Juicing Your Cameras With Math" https://gamedeveloper.com/programming/video-sprucing-up-cameras-with-math · https://gamedeveloper.com/design/enemy-attacks-and-telegraphing

## 7. Stamina / dodge / i-frames
- Souls-like: ทำท่าได้เมื่อ stamina > 0, ฟื้นหลังหยุดใช้สักพัก
- BotW: หมดแรงแล้วช้าลงและทำท่าไม่ได้จนฟื้น
- I-frames อยู่ช่วงกลางของการกลิ้ง ไม่ใช่ตลอดท่า
- อ้างอิง: https://darksouls.wiki.fextralife.com/COMBAT · https://zeldawiki.wiki/wiki/Stamina_Wheel · https://critpoints.net/2017/07/25/how-iframes-augment-dodge-rolls/

## 8. Collision แบบง่าย
- วงกลม-วงกลม, วงกลม-AABB (clamp จุดศูนย์กลางเข้ากล่อง → หาจุดใกล้สุด)
- อ้างอิง: https://learnopengl.com/In-Practice/2D-Game/Collisions/Collision-detection · https://learnopengl.com/In-Practice/2D-Game/Collisions/Collision-resolution · https://abratabia.com/game-physics/engine-vs-handrolled.php

## 9. แหล่งเรียนต่อ
- three.js docs/manual: https://threejs.org/docs/ · Discover three.js: https://discoverthreejs.com · Three.js Journey (เสียเงิน): https://threejs-journey.com/
- Asset ฟรี CC0: https://kenney.nl · https://quaternius.com
- Godot "Your first 3D game": https://docs.godotengine.org/en/stable/getting_started/first_3d_game/
- Web Audio: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques
