export type GameMode = "solo" | "coop" | "pvp";

export interface LobbyPlayer {
  id: number;
  name: string;
  isHost: boolean;
}

export interface InputKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface PlayerState {
  id: number;
  x: number;
  y: number;
  hp: number;
  aimAngle: number;
  weaponKey: string;
  score: number;
  dead: boolean;
  facingLeft: boolean;
}

export interface EnemyState {
  id: number;
  x: number;
  y: number;
  hp: number;
  kind: string;
  dying?: boolean;
}

export interface BossState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface PickupState {
  id: number;
  x: number;
  y: number;
  kind: string;
}

export interface StateSnapshot {
  wave: number;
  players: PlayerState[];
  enemies: EnemyState[];
  boss: BossState | null;
  pickups: PickupState[];
}

export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "input"; keys: InputKeys; aimAngle: number; shooting: boolean; weaponKey: string }
  | { type: "start_game"; roomKey: string; mode: GameMode }
  | { type: "state"; payload: StateSnapshot };

export type ServerMessage =
  | { type: "assigned"; playerId: number; isHost: boolean }
  | { type: "lobby_update"; players: LobbyPlayer[] }
  | { type: "input_relay"; playerId: number; keys: InputKeys; aimAngle: number; shooting: boolean; weaponKey: string }
  | { type: "game_start"; roomKey: string; mode: GameMode; seed: number; players: LobbyPlayer[] }
  | { type: "state"; players: PlayerState[]; enemies: EnemyState[]; boss: BossState | null; wave: number; pickups: PickupState[] }
  | { type: "player_left"; playerId: number }
  | { type: "host_left" }
  | { type: "error"; message: string };
