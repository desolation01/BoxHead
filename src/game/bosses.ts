export const SPLITTER_BOSS_WAVE = 10;
export const SPLITTER_BOSS_MAX_KILLS = 10;

interface SplitterBossDeathInput {
  spawned: number;
  killed: number;
  parentHp: number;
  parentScale: number;
}

interface SplitterBossSpawnPlan {
  hp: number;
  scale: number;
}

interface SplitterBossDeathPlan {
  copiesToSpawn: SplitterBossSpawnPlan[];
  totalSpawned: number;
  remainingKills: number;
}

export function planSplitterBossDeath(input: SplitterBossDeathInput): SplitterBossDeathPlan {
  const remainingSlots = Math.max(0, SPLITTER_BOSS_MAX_KILLS - input.spawned);
  const copyCount = Math.min(2, remainingSlots);
  const childScale = Math.max(0.42, Number((input.parentScale * 0.78).toFixed(2)));
  const childHp = Math.max(24, Math.ceil(input.parentHp * 0.62));

  return {
    copiesToSpawn: Array.from({ length: copyCount }, () => ({ hp: childHp, scale: childScale })),
    totalSpawned: input.spawned + copyCount,
    remainingKills: Math.max(0, SPLITTER_BOSS_MAX_KILLS - input.killed)
  };
}
