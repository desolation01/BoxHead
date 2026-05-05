import { describe, expect, it } from "vitest";
import { resolveRelayWebSocketUrl } from "../net/url";

describe("resolveRelayWebSocketUrl", () => {
  it("keeps explicit websocket urls unchanged", () => {
    expect(resolveRelayWebSocketUrl("wss://relay.example.com")).toBe("wss://relay.example.com");
    expect(resolveRelayWebSocketUrl("ws://localhost:3001")).toBe("ws://localhost:3001");
  });

  it("converts http urls to websocket urls", () => {
    expect(resolveRelayWebSocketUrl("https://abc.ngrok-free.app")).toBe("wss://abc.ngrok-free.app/relay");
    expect(resolveRelayWebSocketUrl("http://192.168.1.20:3001")).toBe("ws://192.168.1.20:3001/relay");
  });

  it("accepts host or host:port input", () => {
    expect(resolveRelayWebSocketUrl("localhost")).toBe("ws://localhost:3001");
    expect(resolveRelayWebSocketUrl("192.168.1.20:4444")).toBe("ws://192.168.1.20:4444");
  });
});
