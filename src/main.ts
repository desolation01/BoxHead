import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { GameScene } from "./game/scenes/GameScene";
import { LobbyScene } from "./game/scenes/LobbyScene";
import { MenuScene } from "./game/scenes/MenuScene";
import { ModeScene } from "./game/scenes/ModeScene";
import { setupInstallPrompt } from "./pwaInstall";
import "./styles.css";

setupInstallPrompt();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#171717",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: 960,
    height: 640
  },
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
      gravity: { x: 0, y: 0 }
    }
  },
  scene: [BootScene, MenuScene, ModeScene, LobbyScene, GameScene]
};

new Phaser.Game(config);
