export function resolveRelayWebSocketUrl(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error("Empty relay endpoint");

  if (raw.startsWith("ws://") || raw.startsWith("wss://")) {
    return raw;
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    const url = new URL(raw);
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${url.host}/relay`;
  }

  const hasPort = /:\d+$/.test(raw);
  return hasPort ? `ws://${raw}` : `ws://${raw}:3001`;
}
