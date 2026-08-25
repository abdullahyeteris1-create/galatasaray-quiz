import { getSyncedMultiplayerState, multiplayerRpc, multiplayerRpcVoid } from "@/lib/multiplayer-quiz/api";
import type { MemoryRaceLevel, MemoryRaceSession } from "./config";

export type MemoryRacePlayer = { id: string; name: string; seat: number; score: number; correct: number; wrong: number; is_host: boolean };
export type MemoryRaceState = { server_now: string; room: { id: string; code: string; status: string; max_players: number; level: MemoryRaceLevel; round_count: number; current_round: number; starts_at: string | null; ends_at: string | null }; players: MemoryRacePlayer[]; cards: Array<{ index: number; value: string | null; matched: boolean }>; round_score?: number };
export type MemoryRaceCredentials = { room_id: string; player_id: string; token: string; code: string };

export const createRoom = (name: string, maxPlayers: number, level: MemoryRaceLevel, rounds: number) => multiplayerRpc<MemoryRaceCredentials>("memory_race_create_room", { p_name: name, p_max_players: maxPlayers, p_level: level, p_round_count: rounds });
export const joinRoom = (code: string, name: string) => multiplayerRpc<MemoryRaceCredentials>("memory_race_join_room", { p_code: code, p_name: name });
export const getState = (session: MemoryRaceSession) => getSyncedMultiplayerState<MemoryRaceState>("memory_race_get_state", { p_room: session.roomId, p_player: session.playerId, p_token: session.token });
export const hostStart = (session: MemoryRaceSession) => multiplayerRpcVoid("memory_race_host_start", { p_room: session.roomId, p_player: session.playerId, p_token: session.token });
export const submit = (session: MemoryRaceSession, first: number, second: number) => multiplayerRpcVoid("memory_race_submit", { p_room: session.roomId, p_player: session.playerId, p_token: session.token, p_first: first, p_second: second });
export const tick = (session: MemoryRaceSession) => multiplayerRpcVoid("memory_race_tick", { p_room: session.roomId, p_player: session.playerId, p_token: session.token });
