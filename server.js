import { WebSocketServer, WebSocket } from "ws";

const PORT = 3001;
const MAX_PLAYERS = 4;

const wss = new WebSocketServer({ port: PORT });

// playerId → WebSocket
const clients = new Map();
let nextId = 1;
let hostId = null;

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of clients.values()) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function broadcastExcept(excludeId, msg) {
  const data = JSON.stringify(msg);
  for (const [id, ws] of clients.entries()) {
    if (id !== excludeId && ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function getLobbyPlayers() {
  return [...clients.entries()].map(([id, ws]) => ({
    id,
    name: ws.playerName ?? "Player",
    isHost: id === hostId,
  }));
}

wss.on("connection", (ws) => {
  if (clients.size >= MAX_PLAYERS) {
    ws.send(JSON.stringify({ type: "error", message: "Server full (max 4 players)" }));
    ws.close();
    return;
  }

  const playerId = nextId++;
  ws.playerId = playerId;
  ws.playerName = "Player";
  clients.set(playerId, ws);

  const isHost = clients.size === 1;
  if (isHost) hostId = playerId;

  ws.send(JSON.stringify({ type: "assigned", playerId, isHost }));
  broadcast({ type: "lobby_update", players: getLobbyPlayers() });

  ws.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    switch (msg.type) {
      case "join":
        ws.playerName = String(msg.name ?? "Player").slice(0, 20);
        broadcast({ type: "lobby_update", players: getLobbyPlayers() });
        break;

      case "input":
        if (playerId !== hostId && hostId !== null) {
          const hostWs = clients.get(hostId);
          if (hostWs?.readyState === WebSocket.OPEN) {
            hostWs.send(JSON.stringify({
              type: "input_relay",
              playerId,
              keys: msg.keys,
              aimAngle: msg.aimAngle,
              shooting: msg.shooting,
              weaponKey: msg.weaponKey,
            }));
          }
        }
        break;

      case "start_game":
        if (playerId === hostId) {
          broadcast({
            type: "game_start",
            roomKey: msg.roomKey,
            mode: msg.mode,
            seed: Math.floor(Math.random() * 2 ** 31),
            players: getLobbyPlayers(),
          });
        }
        break;

      case "state":
        if (playerId === hostId) {
          broadcastExcept(hostId, { type: "state", ...msg.payload });
        }
        break;
    }
  });

  ws.on("error", () => {});

  ws.on("close", () => {
    clients.delete(playerId);
    if (playerId === hostId) {
      hostId = null;
      broadcast({ type: "host_left" });
      for (const client of clients.values()) client.close();
      clients.clear();
      nextId = 1;
    } else {
      broadcast({ type: "player_left", playerId });
      broadcast({ type: "lobby_update", players: getLobbyPlayers() });
    }
  });
});

console.log(`BoxHead relay server running on ws://localhost:${PORT}`);
