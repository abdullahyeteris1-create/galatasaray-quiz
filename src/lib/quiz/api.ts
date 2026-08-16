import { getSupabaseClient } from "@/lib/supabase/client";

import { calculateServerOffset } from "./time";
import type {
  QuizState,
  RoomCredentials,
  SyncedQuizState,
} from "./types";

function unwrapRpcResult<T>(data: unknown, functionName: string): T {
  const value = Array.isArray(data) ? data[0] : data;

  if (!value || typeof value !== "object") {
    throw new Error(`${functionName} beklenen yanıtı döndürmedi.`);
  }

  return value as T;
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabaseClient().rpc(name, args);

  if (error) throw error;
  return unwrapRpcResult<T>(data, name);
}

async function rpcVoid(name: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabaseClient().rpc(name, args);
  if (error) throw error;
}

export function createRoom(
  name: string,
  maxPlayers: number,
  questionCount: number,
): Promise<RoomCredentials> {
  return rpc<RoomCredentials>("quiz_create_room", {
    p_name: name,
    p_max_players: maxPlayers,
    p_question_count: questionCount,
  });
}

export function joinRoom(code: string, name: string): Promise<RoomCredentials> {
  return rpc<RoomCredentials>("quiz_join_room", {
    p_code: code,
    p_name: name,
  });
}

export async function getQuizState(
  roomId: string,
  playerId: string,
  token: string,
): Promise<SyncedQuizState> {
  const requestStartedAt = Date.now();
  const state = await rpc<QuizState>("quiz_get_state", {
    p_room: roomId,
    p_player: playerId,
    p_token: token,
  });
  const responseReceivedAt = Date.now();

  return {
    state,
    serverOffsetMs: calculateServerOffset(
      state.server_now,
      requestStartedAt,
      responseReceivedAt,
    ),
  };
}

export async function startGame(
  roomId: string,
  playerId: string,
  token: string,
): Promise<void> {
  await rpcVoid("quiz_host_start", {
    p_room: roomId,
    p_player: playerId,
    p_token: token,
  });
}

export async function hostTick(
  roomId: string,
  playerId: string,
  token: string,
): Promise<void> {
  await rpcVoid("quiz_host_tick", {
    p_room: roomId,
    p_player: playerId,
    p_token: token,
  });
}

export async function answerQuestion(
  roomId: string,
  roundId: string,
  playerId: string,
  token: string,
  selected: number,
): Promise<void> {
  await rpcVoid("quiz_player_answer", {
    p_room: roomId,
    p_round: roundId,
    p_player: playerId,
    p_token: token,
    p_selected: selected,
  });
}
