# TAILBLADE

PIXEL ACTION ADVENTURE — a mobile-first 2D pixel action game built with HTML5 Canvas.

How to host
1. Create a GitHub repository and add these files: `index.html`, `style.css`, `game.js`, `README.md`.
2. In repository settings, enable GitHub Pages (select the branch where files are, e.g. `main`).
3. Open the published URL on iPhone Safari (or desktop browser). The game is landscape-only — rotate your device.

Controls
- Mobile: on-screen touch buttons (Left, Right, Jump, Attack, Dash). Multi-touch supported.
- Desktop:
  - A / ← = Left
  - D / → = Right
  - W / ↑ / Space = Jump
  - Z / J = Attack
  - Shift / K = Dash
  - Esc = Pause

Features implemented
- Landscape-only mobile gameplay with orientation overlay.
- Zoom/scroll prevention (viewport meta, touch-action, gesturestart prevention).
- Safe area aware UI (uses CSS env(safe-area-inset-bottom)).
- Player with multiple states (idle, move, jump, dash, attack, damaged, death).
- Movement with acceleration/friction, gravity, double-jump logic.
- Dash with residual particles, invulnerability and cooldown.
- Attack system with arc hit detection, combo stages, hitstop, knockback, particles, screen shake and score.
- Enemies: normal, fast, big — each with stats and behavior.
- Coins placed in stage, with pickup effect and sound.
- Stage with platforms, gaps, different areas and boss trigger.
- Boss: NIGHT GUARDIAN with 3 attack patterns, HP bar and intro.
- UI: HP, SCORE, COMBO, AREA, Pause, Start, Game Over, Stage Clear.
- Particles and simple pixel-art drawing entirely via Canvas (no external images).
- WebAudio-based sound effects (synthesized), unlocked on user interaction.
- requestAnimationFrame game loop with deltaTime clamping.
- localStorage save for high score and best combo.
- Supabase readiness: code is local-first; Supabase integration point can be added later without breaking the game.

Notes / next steps
- The game is designed to be lightweight and fully client-side — no build step required.
- If you want to add real art or music, replace procedural drawing with image assets and load them.
- For online leaderboard, add Supabase client initialization behind a config UI (keys must not be hard-coded).

Enjoy TAILBLADE! If you want, I can:
- Push these files into a GitHub repo for you (if you provide repo name and grant access).
- Add more levels, polish pixel art, or add touch haptics and more SFX.
