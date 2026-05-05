import { describe, expect, it } from "vitest";
import { planSplitterBossDeath } from "../bosses";

describe("splitter boss", () => {
  it("spawns smaller copies and caps the encounter at 10 total kills", () => {
    const firstDeath = planSplitterBossDeath({ spawned: 1, killed: 1, parentHp: 250, parentScale: 1 });

    expect(firstDeath.copiesToSpawn).toHaveLength(2);
    expect(firstDeath.copiesToSpawn[0]!.hp).toBeLessThan(250);
    expect(firstDeath.copiesToSpawn[0]!.scale).toBeLessThan(1);

    const nearCap = planSplitterBossDeath({ spawned: 9, killed: 9, parentHp: 60, parentScale: 0.5 });

    expect(nearCap.copiesToSpawn).toHaveLength(1);
    expect(nearCap.totalSpawned).toBe(10);
    expect(nearCap.remainingKills).toBe(1);

    const capped = planSplitterBossDeath({ spawned: 10, killed: 10, parentHp: 40, parentScale: 0.42 });

    expect(capped.copiesToSpawn).toHaveLength(0);
    expect(capped.remainingKills).toBe(0);
  });
});
