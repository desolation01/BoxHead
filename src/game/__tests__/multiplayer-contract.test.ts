import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("multiplayer scene wiring", () => {
  it("registers mode and lobby scenes in the Phaser config", () => {
    const source = read("src/main.ts");

    expect(source).toContain("ModeScene");
    expect(source).toContain("LobbyScene");
    expect(source).toMatch(/scene:\s*\[BootScene,\s*MenuScene,\s*ModeScene,\s*LobbyScene,\s*GameScene\]/);
  });

  it("routes the main menu play action to mode select before map select", () => {
    const source = read("src/game/scenes/MenuScene.ts");

    expect(source).toContain('data-play');
    expect(source).toContain('this.scene.start("ModeScene")');
    expect(source).toContain("selectRoom");
  });

  it("provides lobby host and join controls backed by NetworkManager", () => {
    const source = read("src/game/scenes/LobbyScene.ts");

    expect(source).toContain("Host Game");
    expect(source).toContain("Join Game");
    expect(source).toContain("network.connect");
    expect(source).toContain('type: "start_game"');
  });
});

describe("GameScene multiplayer hooks", () => {
  it("tracks multiplayer mode, remote players, snapshots, and spectator UI", () => {
    const source = read("src/game/scenes/GameScene.ts");

    expect(source).toContain("remotePlayers");
    expect(source).toContain("latestSnapshot");
    expect(source).toContain("broadcastState");
    expect(source).toContain("applySnapshot");
    expect(source).toContain("sendLocalInput");
    expect(source).toContain("enterSpectatorMode");
    expect(source).toContain("checkMultiplayerGameOver");
  });

  it("starts new runs on wave 1", () => {
    const source = read("src/game/scenes/GameScene.ts");

    expect(source).toContain("const STARTING_WAVE = 1");
    expect(source).toContain("private waveNumber = STARTING_WAVE");
    expect(source).toContain("this.startWave(STARTING_WAVE)");
    expect(source).toContain("this.waveNumber = STARTING_WAVE");
  });

  it("relays remote player weapon choice with shooting input for host-authoritative damage", () => {
    const gameScene = read("src/game/scenes/GameScene.ts");
    const netTypes = read("src/game/net/types.ts");
    const networkManager = read("src/game/net/NetworkManager.ts");
    const server = read("server.js");

    expect(netTypes).toContain('weaponKey: string');
    expect(networkManager).toContain('weaponKey: string');
    expect(server).toContain('weaponKey: msg.weaponKey');
    expect(gameScene).toContain('weaponKey: this.currentWeapon.key');
    expect(gameScene).toContain('sprite.currentWeaponKey = input.weaponKey as WeaponKey');
    expect(gameScene).toContain('sprite.weaponImage?.setTexture(HELD_WEAPON_TEXTURES[sprite.currentWeaponKey]');
  });

  it("treats Space as a shooting hotkey for local and relayed input", () => {
    const source = read("src/game/scenes/GameScene.ts");

    expect(source).toContain("SPACE");
    expect(source).toContain("isShootingPressed");
    expect(source).toContain("this.isShootingPressed()");
  });

  it("routes mobile touch controls through the same local input contract", () => {
    const source = read("src/game/scenes/GameScene.ts");
    const html = read("index.html");

    expect(html).toContain("touch-controls");
    expect(source).toContain("createTouchControls");
    expect(source).toContain("touchMoveStick");
    expect(source).toContain("touchAimStick");
    expect(source).toContain("this.touchShooting");
    expect(source).toContain("const movement = this.getMovementVector()");
  });

  it("targets and damages remote players from the host enemy simulation", () => {
    const source = read("src/game/scenes/GameScene.ts");

    expect(source).toContain("getNearestLivingPlayer");
    expect(source).toContain("getLivingPlayers");
    expect(source).toContain("damagePlayerTarget");
    expect(source).toContain("damageRemotePlayer");
    expect(source).toContain("this.damagePlayerTarget(touchTarget, enemy.damage)");
    expect(source).toContain("this.getNearestLivingPlayer(enemy.x, enemy.y)");
  });

  it("keeps non-host spectators synced and resolves remote shots on the host", () => {
    const source = read("src/game/scenes/GameScene.ts");

    expect(source).toContain("this.applyPendingSnapshot()");
    expect(source).toContain("resolveRemoteBulletImpact");
    expect(source).toContain("getFirstBulletImpact");
    expect(source).toContain("barrel?: BarrelSprite");
    expect(source).toContain("this.explodeBarrel(impact.barrel)");
    expect(source.indexOf("this.applyPendingSnapshot()")).toBeLessThan(source.indexOf("if (this.spectating)"));
  });

  it("sends killed enemies as dying snapshots so non-hosts play death animation quickly", () => {
    const source = read("src/game/scenes/GameScene.ts");
    const netTypes = read("src/game/net/types.ts");

    expect(netTypes).toContain("dying?: boolean");
    expect(source).toContain("enemy.deathHandled = true");
    expect(source).toContain("dying: !!enemy.deathHandled");
    expect(source).toContain("this.broadcastImmediateState()");
    expect(source).toContain("playSnapshotEnemyDeath");
  });

  it("keeps host authority running when the host is spectating after death", () => {
    const source = read("src/game/scenes/GameScene.ts");

    expect(source).toContain("handleSpectatorControls");
    expect(source).toContain('if (this.spectating && (!this.isHost || this.gameMode === "solo"))');
    expect(source.indexOf("if (!this.spectating)")).toBeLessThan(source.indexOf("this.applyRemoteInputs(time)"));
    expect(source.indexOf("this.applyRemoteInputs(time)")).toBeLessThan(source.indexOf("this.broadcastState()"));
  });
});
