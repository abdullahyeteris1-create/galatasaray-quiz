import { getSupabaseClient } from "@/lib/supabase/client";
import { calculateServerOffset } from "@/lib/quiz/time";
import { multiplayerRpcVoid } from "@/lib/multiplayer-quiz/api";
import type { MemoryRaceLevel, MemoryRaceSession } from "./config";

export type MemoryRacePlayer = { id: string; name: string; seat: number; score: number; correct: number; wrong: number; is_host: boolean };
export type MemoryRaceState = { server_now: string; room: { id: string; code: string; status: string; max_players: number; level: MemoryRaceLevel; round_count: number; current_round: number; starts_at: string | null; ends_at: string | null; current_player_id: string | null; turn_number: number; first_card_index: number | null; second_card_index: number | null; reveal_until: string | null }; players: MemoryRacePlayer[]; cards: Array<{ index: number; value: string | null; matched: boolean; matched_by_player_id: string | null }>; };
export type MemoryRaceCredentials = { room_id: string; player_id: string; token: string; code: string };

export class MemoryRaceRpcError extends Error {
  constructor(public readonly code: string | undefined, message: string) {
    super(message);
    this.name = "MemoryRaceRpcError";
  }
}

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rpcErrorMessage(error: unknown) {
  if (!isRecord(error)) return { code: undefined, message: "Supabase RPC hatası", details: undefined, hint: undefined };
  return {
    code: typeof error.code === "string" ? error.code : undefined,
    message: typeof error.message === "string" ? error.message : undefined,
    details: typeof error.details === "string" ? error.details : undefined,
    hint: typeof error.hint === "string" ? error.hint : undefined,
  };
}

function logRpcError(functionName: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${functionName}] Supabase RPC error`, rpcErrorMessage(error));
  }
}

function normalizeMemoryRaceState(data: unknown): MemoryRaceState {
  if (!isRecord(data) || !isRecord(data.room) || typeof data.server_now !== "string") {
    throw new Error("memory_race_get_state geçersiz response döndürdü.");
  }

  const room = data.room;
  if (
    typeof room.id !== "string" ||
    typeof room.code !== "string" ||
    typeof room.status !== "string" ||
    typeof room.max_players !== "number" ||
    typeof room.level !== "number" ||
    typeof room.round_count !== "number" ||
    typeof room.current_round !== "number"
  ) {
    throw new Error("memory_race_get_state room alanları eksik.");
  }

  const players = Array.isArray(data.players) ? data.players : [];
  const normalizedPlayers = players.map((player): MemoryRacePlayer => {
    if (!isRecord(player)) throw new Error("memory_race_get_state players alanı geçersiz.");
    return {
      id: String(player.id),
      name: String(player.name),
      seat: Number(player.seat),
      score: Number(player.score),
      correct: Number(player.correct),
      wrong: Number(player.wrong),
      is_host: Boolean(player.is_host),
    };
  });

  const cards = Array.isArray(data.cards) ? data.cards : [];
  const normalizedCards = cards.map((card) => {
    if (!isRecord(card)) throw new Error("memory_race_get_state cards alanı geçersiz.");
    return {
      index: Number(card.index),
      value: card.value === null || card.value === undefined ? null : String(card.value),
      matched: Boolean(card.matched),
      matched_by_player_id: card.matched_by_player_id === null || card.matched_by_player_id === undefined ? null : String(card.matched_by_player_id),
    };
  });

  return {
    server_now: data.server_now,
    room: {
      id: room.id,
      code: room.code,
      status: room.status,
      max_players: room.max_players,
      level: room.level as MemoryRaceLevel,
      round_count: room.round_count,
      current_round: room.current_round,
      starts_at: room.starts_at === null || room.starts_at === undefined ? null : String(room.starts_at),
      ends_at: room.ends_at === null || room.ends_at === undefined ? null : String(room.ends_at),
      current_player_id: room.current_player_id === null || room.current_player_id === undefined ? null : String(room.current_player_id),
      turn_number: Number(room.turn_number ?? 0),
      first_card_index: room.first_card_index === null || room.first_card_index === undefined ? null : Number(room.first_card_index),
      second_card_index: room.second_card_index === null || room.second_card_index === undefined ? null : Number(room.second_card_index),
      reveal_until: room.reveal_until === null || room.reveal_until === undefined ? null : String(room.reveal_until),
    },
    players: normalizedPlayers,
    cards: normalizedCards,
  };
}

function normalizeCredentials(data: unknown): MemoryRaceCredentials {
  if (!isRecord(data) || typeof data.room_id !== "string" || typeof data.player_id !== "string" || typeof data.token !== "string" || typeof data.code !== "string") {
    throw new Error("Oda oluşturma yanıtı geçersiz.");
  }
  return { room_id: data.room_id, player_id: data.player_id, token: data.token, code: data.code };
}

async function callCredentialsRpc(functionName: string, args: Record<string, unknown>): Promise<MemoryRaceCredentials> {
  const { data, error } = await getSupabaseClient().rpc(functionName, args);
  if (error) {
    logRpcError(functionName, error);
    throw new Error("Oda işlemi tamamlanamadı.");
  }
  try {
    return normalizeCredentials(data);
  } catch (error) {
    logRpcError(`${functionName} response`, error);
    throw new Error("Oda işlemi geçersiz yanıt verdi.");
  }
}

export const createRoom = (name: string, maxPlayers: number, level: MemoryRaceLevel, rounds: number) => callCredentialsRpc("memory_race_create_room", { p_name: name, p_max_players: maxPlayers, p_level: level, p_round_count: rounds });
export const joinRoom = (code: string, name: string) => callCredentialsRpc("memory_race_join_room", { p_code: code, p_name: name });
export async function getState(session: MemoryRaceSession): Promise<{ state: MemoryRaceState; serverOffsetMs: number }> {
  const requestStartedAt = Date.now();
  const { data, error } = await getSupabaseClient().rpc("memory_race_get_state", {
    p_room: session.roomId,
    p_player: session.playerId,
    p_token: session.token,
  });

  if (error) {
    logRpcError("memory_race_get_state", error);
    const details = rpcErrorMessage(error);
    throw new MemoryRaceRpcError(details.code, "Oda durumu alınamadı.");
  }

  try {
    const state = normalizeMemoryRaceState(data);
    return {
      state,
      serverOffsetMs: calculateServerOffset(state.server_now, requestStartedAt, Date.now()),
    };
  } catch (error) {
    logRpcError("memory_race_get_state response", error);
    throw new MemoryRaceRpcError(undefined, "Oda durumu alınamadı.");
  }
}
export const hostStart = (session: MemoryRaceSession) => multiplayerRpcVoid("memory_race_host_start", { p_room: session.roomId, p_player: session.playerId, p_token: session.token });
export const flipCard = (session: MemoryRaceSession, cardIndex: number) => multiplayerRpcVoid("memory_race_flip_card", { p_room: session.roomId, p_player: session.playerId, p_token: session.token, p_card_index: cardIndex });
export const submit = (session: MemoryRaceSession, first: number, second: number) => multiplayerRpcVoid("memory_race_submit", { p_room: session.roomId, p_player: session.playerId, p_token: session.token, p_first: first, p_second: second });
export const tick = (session: MemoryRaceSession) => multiplayerRpcVoid("memory_race_tick", { p_room: session.roomId, p_player: session.playerId, p_token: session.token });
