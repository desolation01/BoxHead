import Phaser from "phaser";

export class ModeScene extends Phaser.Scene {
  private menuEl: HTMLElement | null = null;

  constructor() {
    super("ModeScene");
  }

  create(): void {
    this.menuEl = document.querySelector("#menu");
    if (!this.menuEl) return;

    this.menuEl.classList.remove("is-hidden");
    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">Select Mode</h1>
        <p class="menu__copy">Solo: classic single-player. Co-op: fight together, friendly fire off. PvP: fight everyone, friendly fire on.</p>
        <button class="menu__action" data-mode="solo">Solo</button>
        <button class="menu__action" data-mode="coop">Co-op (LAN, up to 4)</button>
        <button class="menu__action" data-mode="pvp">PvP (LAN, up to 4)</button>
        <button class="menu__action" data-back>Back</button>
      </section>
    `;

    this.menuEl.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode!;
        this.menuEl?.classList.add("is-hidden");
        if (mode === "solo") {
          this.scene.start("MenuScene", { selectRoom: true });
        } else {
          this.scene.start("LobbyScene", { mode });
        }
      });
    });

    this.menuEl.querySelector("[data-back]")?.addEventListener("click", () => {
      this.menuEl?.classList.add("is-hidden");
      this.scene.start("MenuScene");
    });
  }
}
