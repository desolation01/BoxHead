import type { WaveDefinition } from "./types";

export function createWave(wave: number): WaveDefinition {
  const clampedWave = Math.max(1, Math.floor(wave));
  return {
    wave: clampedWave,
    enemyCount: 8 + clampedWave * 4 + Math.floor(clampedWave * clampedWave * 0.35),
    spawnDelayMs: Math.max(210, 850 - clampedWave * 42),
    enemySpeed: Math.min(150, 58 + clampedWave * 6),
    enemyHealth: 2 + Math.floor(clampedWave / 3),
    scoreReward: 60 + clampedWave * 8
  };
}
