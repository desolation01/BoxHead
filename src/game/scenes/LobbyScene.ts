import Phaser from "phaser";
import { network } from "../net/NetworkManager";
import type { GameMode, LobbyPlayer } from "../net/types";
import { ROOMS } from "../rooms";

interface LobbySceneData {
  mode: GameMode;
}

const PLAYER_COLORS = ["#ffffff", "#6ab0ff", "#6dff8a", "#ffd76a"];

export class LobbyScene extends Phaser.Scene {
  private menuEl: HTMLElement | null = null;
  private mode: GameMode = "coop";
  private players: LobbyPlayer[] = [];
  private myId: number | null = null;
  private isHost = false;
  private selectedRoom = ROOMS[0]?.key ?? "crossfire";
  private playerName = "Player";

  constructor() {
    super("LobbyScene");
  }

  init(data: LobbySceneData): void {
    this.mode = data.mode ?? "coop";
    this.players = [];
    this.myId = null;
    this.isHost = false;
    network.disconnect();
  }

  create(): void {
    this.menuEl = document.querySelector("#menu");
    this.renderNameEntry();
  }

  private renderNameEntry(): void {
    if (!this.menuEl) return;

    const modeLabel = this.mode === "coop" ? "Co-op" : "PvP";
    this.menuEl.classList.remove("is-hidden");
    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">${modeLabel}</h1>
        <input id="lobby-name" class="lobby-input" type="text" placeholder="Your name" maxlength="20" />
        <button class="menu__action" data-host>Host Game</button>
        <button class="menu__action" data-join>Join Game</button>
        <button class="menu__action" data-back>Back</button>
      </section>
    `;

    this.menuEl.querySelector("[data-host]")?.addEventListener("click", () => {
      this.connectToLobby("localhost", this.getNameInput());
    });
    this.menuEl.querySelector("[data-join]")?.addEventListener("click", () => this.renderJoinEntry());
    this.menuEl.querySelector("[data-back]")?.addEventListener("click", () => {
      network.disconnect();
      this.scene.start("ModeScene");
    });
  }

  private renderJoinEntry(): void {
    if (!this.menuEl) return;

    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">Join Game</h1>
        <input id="lobby-name" class="lobby-input" type="text" placeholder="Your name" maxlength="20" />
        <input id="lobby-host" class="lobby-input" type="text" placeholder="Relay URL or host (e.g. wss://abc.ngrok-free.app or 192.168.1.5)" value="localhost" />
        <button class="menu__action" data-connect>Connect</button>
        <button class="menu__action" data-back>Back</button>
      </section>
    `;

    this.menuEl.querySelector("[data-connect]")?.addEventListener("click", () => {
      const hostInput = this.menuEl?.querySelector<HTMLInputElement>("#lobby-host");
      this.connectToLobby(hostInput?.value.trim() || "localhost", this.getNameInput());
    });
    this.menuEl.querySelector("[data-back]")?.addEventListener("click", () => this.renderNameEntry());
  }

  private getNameInput(): string {
    const input = this.menuEl?.querySelector<HTMLInputElement>("#lobby-name");
    const value = input?.value.trim();
    this.playerName = value || "Player";
    return this.playerName;
  }

  private connectToLobby(host: string, name: string): void {
    this.renderStatus("Connecting...");
    network.on("assigned", (msg) => {
      this.myId = msg.playerId;
      this.isHost = msg.isHost;
    });
    network.on("lobby_update", (msg) => {
      this.players = msg.players;
      this.renderLobby();
    });
    network.on("game_start", (msg) => {
      this.menuEl?.classList.add("is-hidden");
      this.scene.start("GameScene", {
        roomKey: msg.roomKey,
        mode: msg.mode,
        myId: this.myId ?? 1,
        isHost: this.isHost,
        players: msg.players,
        seed: msg.seed
      });
    });
    network.on("host_left", () => {
      this.renderStatus("Host disconnected. Returning to menu...");
      this.time.delayedCall(3000, () => this.scene.start("ModeScene"));
    });
    network.on("error", (msg) => this.renderStatus(msg.message));

    const connection = network.connect(host);
    void connection
      .then(() => network.send({ type: "join", name }))
      .catch(() => this.renderStatus("Could not connect to host."));
  }

  private renderStatus(message: string): void {
    if (!this.menuEl) return;

    this.menuEl.classList.remove("is-hidden");
    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">Lobby</h1>
        <p class="menu__copy">${message}</p>
        <button class="menu__action" data-back>Back</button>
      </section>
    `;
    this.menuEl.querySelector("[data-back]")?.addEventListener("click", () => {
      network.disconnect();
      this.renderNameEntry();
    });
  }

  private renderLobby(): void {
    if (!this.menuEl) return;

    this.menuEl.classList.remove("is-hidden");
    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">Lobby</h1>
        <div class="lobby-players">
          ${this.players.map((player, index) => `
            <div class="lobby-player">
              <span class="lobby-player__swatch" style="background:${PLAYER_COLORS[index] ?? "#ffffff"}"></span>
              <span>${player.name}${player.isHost ? " <em>HOST</em>" : ""}</span>
            </div>
          `).join("")}
        </div>
        ${this.isHost ? this.renderHostControls() : '<p class="menu__copy">Waiting for host to start...</p>'}
        <button class="menu__action" data-leave>Leave Lobby</button>
      </section>
    `;

    this.menuEl.querySelector<HTMLSelectElement>("[data-room-select]")?.addEventListener("change", (event) => {
      this.selectedRoom = (event.currentTarget as HTMLSelectElement).value;
    });
    this.menuEl.querySelector("[data-start]")?.addEventListener("click", () => {
      network.send({ type: "start_game", roomKey: this.selectedRoom, mode: this.mode });
    });
    this.menuEl.querySelector("[data-leave]")?.addEventListener("click", () => {
      network.disconnect();
      this.scene.start("ModeScene");
    });
  }

  private renderHostControls(): string {
    return `
      <select class="lobby-input" data-room-select>
        ${ROOMS.map((room) => `<option value="${room.key}"${room.key === this.selectedRoom ? " selected" : ""}>${room.name}</option>`).join("")}
      </select>
      <button class="menu__action" data-start>Start Game</button>
    `;
  }
}
