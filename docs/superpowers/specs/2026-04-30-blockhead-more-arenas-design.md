# Blockhead: More Arenas Design

## Goal

Build an original browser survival shooter inspired by the feel of Boxhead: More Rooms: compact top-down arenas, blocky characters, escalating zombie waves, weapon progression, barricades, explosive barrels, pickups, score pressure, and a fast restart loop.

## Boundaries

The game should feel mechanically faithful, but all implementation, names, maps, art, audio, and UI are original. The project will not use ripped assets, the Boxhead name, exact copyrighted maps, original sounds, or branded presentation.

## Stack

- Phaser 3 for the 2D canvas runtime.
- TypeScript for gameplay modules and scene code.
- Vite for local development and builds.
- DOM overlay for HUD and menu shell text.

## Core Loop

The player chooses a room, survives enemy waves, collects ammo and health pickups, unlocks stronger weapons through score thresholds, and uses barricades or explosive barrels to control enemy flow. A run ends when health reaches zero. The game shows score, wave, health, current weapon, ammo, and restart controls.

## First Playable Scope

- Main menu and room selection.
- Three original rooms with “More Rooms”-style layouts.
- Keyboard movement and mouse aiming/shooting.
- Zombies that chase and damage the player.
- Wave spawns with increasing pressure.
- Weapon ladder: pistol, shotgun, uzi, barrel launcher, rail burst.
- Ammo, health, and weapon pickups.
- Barricades that enemies can damage.
- Explosive barrels with area damage.
- Game over and restart.

## Architecture

Gameplay rules live in small TypeScript modules for room data, weapon data, and wave tuning. Phaser scenes own rendering, physics bodies, generated textures, input plumbing, effects, and HUD synchronization. The HUD remains DOM-based so text-heavy status stays crisp and easy to update.

## Verification

Use Vitest for pure gameplay data/system checks and Vite build for TypeScript integration. Use a local dev server for manual browser verification.
