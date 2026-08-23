import { getSyncedMultiplayerState, multiplayerRpc, multiplayerRpcVoid } from "@/lib/multiplayer-quiz/api";

export type MemoryCredentials = { room_id: string; player_id: string; token: string; code: string };
export type MemorySession = { version: 1; roomId: string; playerId: string; token: string; code: string };
export type MemoryCardState = { id: string; position: number; state: "hidden" | "open" | "matched"; name?: string; image?: string };
export type MemoryState = { server_now: string; room: { id: string; code: string; status: string; max_players: number; card_count: number; current_player_id: string | null; turn_number: number }; players: Array<{ id: string; name: string; seat: number; score: number; matches: number; wrong: number; is_host: boolean }>; cards: MemoryCardState[]; reveal_until?: string };

export const memoryCreateRoom = (name: string, maxPlayers: number, cardCount: number) => multiplayerRpc<MemoryCredentials>("memory_create_room", { p_name: name, p_max_players: maxPlayers, p_card_count: cardCount });
export const memoryJoinRoom = (code: string, name: string) => multiplayerRpc<MemoryCredentials>("memory_join_room", { p_code: code, p_name: name });
export const memoryGetState = (session: MemorySession) => getSyncedMultiplayerState<MemoryState>("memory_get_state", { p_room: session.roomId, p_player: session.playerId, p_token: session.token });
export const memoryStartRoom = (session: MemorySession) => multiplayerRpcVoid("memory_host_start", { p_room: session.roomId, p_player: session.playerId, p_token: session.token });
export const memoryFlipCard = (session: MemorySession, card: string) => multiplayerRpcVoid("memory_flip_card", { p_room: session.roomId, p_player: session.playerId, p_token: session.token, p_card: card });
export const memoryTick = (session: MemorySession) => multiplayerRpcVoid("memory_tick", { p_room: session.roomId, p_player: session.playerId, p_token: session.token });
