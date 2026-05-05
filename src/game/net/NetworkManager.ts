import type { ClientMessage, InputKeys, ServerMessage } from "./types";
import { resolveRelayWebSocketUrl } from "./url";

type QueuedInput = { playerId: number; keys: InputKeys; aimAngle: number; shooting: boolean; weaponKey: string };

export class NetworkManager {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Array<(msg: ServerMessage) => void>>();
  private inputQueue: QueuedInput[] = [];
  private _intentionalClose = false;

  connect(host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(resolveRelayWebSocketUrl(host));
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error("Connection failed"));
      this.ws.onmessage = (event) => {
        let msg: ServerMessage;
        try { msg = JSON.parse(event.data); } catch { return; }
        for (const handler of this.handlers.get(msg.type) ?? []) handler(msg);
      };
      this.ws.onclose = () => {
        if (!this._intentionalClose) {
          for (const handler of this.handlers.get("host_left") ?? []) {
            handler({ type: "host_left" });
          }
        }
        this._intentionalClose = false;
      };
    });
  }

  on<T extends ServerMessage["type"]>(
    type: T,
    handler: (msg: Extract<ServerMessage, { type: T }>) => void
  ): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as (msg: ServerMessage) => void);
    this.handlers.set(type, list);
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  enqueueInput(input: QueuedInput): void {
    const idx = this.inputQueue.findIndex((i) => i.playerId === input.playerId);
    if (idx >= 0) this.inputQueue[idx] = input;
    else this.inputQueue.push(input);
  }

  drainInputs(): QueuedInput[] {
    const queue = [...this.inputQueue];
    this.inputQueue = [];
    return queue;
  }

  disconnect(): void {
    this._intentionalClose = true;
    this.ws?.close();
    this.ws = null;
    this._intentionalClose = false;
    this.inputQueue = [];
    this.handlers.clear();
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const network = new NetworkManager();
