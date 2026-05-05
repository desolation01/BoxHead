# Blockhead: More Arenas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable original top-down arena survival shooter inspired by Boxhead: More Rooms.

**Architecture:** Use Phaser scenes for rendering, physics, input, and effects while keeping room, weapon, and wave data in focused TypeScript modules. Use generated blocky textures for the first playable version and DOM HUD elements for status.

**Tech Stack:** Phaser 3, TypeScript, Vite, Vitest.

---

### Task 1: Project Shell

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/main.ts`
- Create: `src/styles.css`

- [ ] Add Vite, Phaser, TypeScript, and Vitest configuration.
- [ ] Add root HTML with menu/HUD overlay containers.
- [ ] Bootstrap Phaser from `src/main.ts`.

### Task 2: Gameplay Data

**Files:**
- Create: `src/game/types.ts`
- Create: `src/game/weapons.ts`
- Create: `src/game/rooms.ts`
- Create: `src/game/waves.ts`
- Create: `src/game/__tests__/systems.test.ts`

- [ ] Define room layouts, spawn points, weapons, pickups, and wave scaling.
- [ ] Add tests for weapon unlock order, wave scaling, and room data validity.

### Task 3: Phaser Scenes

**Files:**
- Create: `src/game/scenes/BootScene.ts`
- Create: `src/game/scenes/MenuScene.ts`
- Create: `src/game/scenes/GameScene.ts`

- [ ] Generate original blocky textures in the boot scene.
- [ ] Add menu/room select scene.
- [ ] Add gameplay scene with player movement, aiming, shooting, enemies, hazards, pickups, and wave restarts.

### Task 4: Presentation and Verification

**Files:**
- Modify: `src/styles.css`
- Modify: `src/game/scenes/GameScene.ts`

- [ ] Polish HUD and menu readability.
- [ ] Run `npm install`.
- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Start `npm run dev` for local play.
