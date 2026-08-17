import { getSupabaseClient } from "@/lib/supabase/client";
import { calculateServerOffset } from "@/lib/quiz/time";

import type { SuperLigState, SyncedSuperLigState, SuperLigCredentials, SuperLigEra } from "./types";

function unwrap<T>(data: unknown, name: string): T {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") throw new Error(`${name} beklenen yanıtı döndürmedi.`);
  return value as T;
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabaseClient().rpc(name, args);
  if (error) throw error;
  return unwrap<T>(data, name);
}

async function rpcVoid(name: string, args: Record<string, unknown>) {
  await rpc<unknown>(name, args);
}

export function createSuperLigRoom(name: string, era: SuperLigEra, questionCount: number) {
  return rpc<SuperLigCredentials>("quiz_super_lig_create_room", {
    p_name: name,
    p_era: era,
    p_question_count: questionCount,
  });
}

export function joinSuperLigRoom(code: string, name: string) {
  return rpc<SuperLigCredentials>("quiz_super_lig_join_room", { p_code: code, p_name: name });
}

export async function getSuperLigState(roomId: string, playerId: string, token: string): Promise<SyncedSuperLigState> {
  const requestStartedAt = Date.now();
  const state = await rpc<SuperLigState>("quiz_super_lig_get_state", {
    p_room: roomId,
    p_player: playerId,
    p_token: token,
  });
  const responseReceivedAt = Date.now();
  return {
    state,
    serverOffsetMs: calculateServerOffset(state.server_now, requestStartedAt, responseReceivedAt),
  };
}

export function startSuperLigGame(roomId: string, playerId: string, token: string) {
  return rpcVoid("quiz_super_lig_host_start", { p_room: roomId, p_player: playerId, p_token: token });
}

export function tickSuperLig(roomId: string, playerId: string, token: string) {
  return rpcVoid("quiz_super_lig_tick", { p_room: roomId, p_player: playerId, p_token: token });
}

export function answerSuperLig(roomId: string, roundId: string, playerId: string, token: string, selected: number) {
  return rpcVoid("quiz_super_lig_player_answer", {
    p_room: roomId,
    p_round: roundId,
    p_player: playerId,
    p_token: token,
    p_selected: selected,
  });
}
