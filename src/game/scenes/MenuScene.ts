import Phaser from "phaser";
import { ROOMS } from "../rooms";

interface MenuSceneData {
  selectRoom?: boolean;
}

export class MenuScene extends Phaser.Scene {
  private menuEl: HTMLElement | null = null;
  private hudEl: HTMLElement | null = null;
  private selectRoom = false;

  constructor() {
    super("MenuScene");
  }

  init(data: MenuSceneData): void {
    this.selectRoom = data.selectRoom ?? false;
  }

  create(): void {
    this.menuEl = document.querySelector("#menu");
    this.hudEl = document.querySelector("#hud");
    this.hudEl?.classList.add("is-hidden");
    this.renderMenu();
  }

  private renderMenu(): void {
    if (this.selectRoom) {
      this.renderRoomSelect();
      return;
    }

    if (!this.menuEl) return;

    this.menuEl.classList.remove("is-hidden");
    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">Blockhead:<br />More Arenas</h1>
        <p class="menu__copy">
          Pick a mode, choose an arena, and survive the crowd. Move with WASD, aim with the mouse,
          fire with left click or Space, or use the on-screen sticks on mobile. Cycle guns with Q.
        </p>
        <button class="menu__action" data-play>Play</button>
      </section>
    `;

    this.menuEl.querySelector("[data-play]")?.addEventListener("click", () => {
      this.menuEl?.classList.add("is-hidden");
      this.scene.start("ModeScene");
    });
  }

  private renderRoomSelect(): void {
    if (!this.menuEl) return;

    this.menuEl.classList.remove("is-hidden");
    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">Choose Arena</h1>
        <p class="menu__copy">
          Solo keeps the classic single-player rules. Pick a room, hold the line, and survive the crowd.
        </p>
        <div class="room-grid">
          ${ROOMS.map(
            (room) => `
              <button class="room-button" data-room="${room.key}">
                ${room.name}
                <span>${room.description}</span>
              </button>
            `
          ).join("")}
        </div>
        <button class="menu__action" data-back>Back</button>
      </section>
    `;

    this.menuEl.querySelectorAll<HTMLButtonElement>("[data-room]").forEach((button) => {
      button.addEventListener("click", () => {
        const roomKey = button.dataset.room;
        if (!roomKey) return;
        this.menuEl?.classList.add("is-hidden");
        this.scene.start("GameScene", { roomKey, mode: "solo" });
      });
    });

    this.menuEl.querySelector("[data-back]")?.addEventListener("click", () => {
      this.menuEl?.classList.add("is-hidden");
      this.scene.start("ModeScene");
    });
  }
}
