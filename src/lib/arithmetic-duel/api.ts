import { getSupabaseClient } from "@/lib/supabase/client";
import { calculateServerOffset } from "@/lib/quiz/time";
import type { ArithmeticDifficulty, ArithmeticDuelSession, ArithmeticOperation, ArithmeticRoundCount, ArithmeticTimeLimit } from "./config";

export type ArithmeticCredentials = { room_id: string; player_id: string; token: string; code: string };
export type ArithmeticPlayer = { id: string; name: string; seat: number; score: number; correct: number; wrong: number; round_wins: number; is_host: boolean };
export type ArithmeticRound = { id: string; number: number; question_text: string; starts_at: string; ends_at: string; answered_by_me: boolean; finished_at: string | null; correct_answer?: number; winner_player_id?: string | null; winner_name?: string | null; reveal_until?: string };
export type ArithmeticState = { server_now: string; room: { id: string; code: string; status: "waiting" | "playing" | "finished"; max_players: number; difficulty: ArithmeticDifficulty; operation: ArithmeticOperation; round_count: ArithmeticRoundCount; time_limit: ArithmeticTimeLimit; current_round: number; host_player_id: string; started_at: string | null; finished_at: string | null }; players: ArithmeticPlayer[]; round: ArithmeticRound | null };

export class ArithmeticDuelRpcError extends Error {
  constructor(public readonly code: string | undefined, message: string) { super(message); this.name = "ArithmeticDuelRpcError"; }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Beklenmeyen RPC yanıtı.");
  return value as Record<string, unknown>;
}

function normalizeCredentials(data: unknown): ArithmeticCredentials {
  const value = asRecord(Array.isArray(data) ? data[0] : data);
  if (["room_id", "player_id", "token", "code"].some((key) => typeof value[key] !== "string")) throw new Error("Oda bilgisi eksik.");
  return { room_id: value.room_id as string, player_id: value.player_id as string, token: value.token as string, code: value.code as string };
}

async function credentialsRpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await getSupabaseClient().rpc(name, args);
  if (error) throw new ArithmeticDuelRpcError(error.code, error.message);
  return normalizeCredentials(data);
}

export const createArithmeticRoom = (name: string, maxPlayers: number, difficulty: ArithmeticDifficulty, operation: ArithmeticOperation, rounds: ArithmeticRoundCount, timeLimit: ArithmeticTimeLimit) => credentialsRpc("arithmetic_duel_create_room", { p_name: name, p_max_players: maxPlayers, p_difficulty: difficulty, p_operation: operation, p_round_count: rounds, p_time_limit: timeLimit });
export const joinArithmeticRoom = (code: string, name: string) => credentialsRpc("arithmetic_duel_join_room", { p_code: code, p_name: name });

export async function getArithmeticState(session: ArithmeticDuelSession) {
  const started = Date.now();
  const { data, error } = await getSupabaseClient().rpc("arithmetic_duel_get_state", { p_room: session.roomId, p_player: session.playerId, p_token: session.token });
  if (error) throw new ArithmeticDuelRpcError(error.code, error.message);
  const value = asRecord(data);
  const state = value as unknown as ArithmeticState;
  if (typeof state.server_now !== "string" || !state.room || !Array.isArray(state.players)) throw new Error("Oyun durumu alınamadı.");
  return { state, serverOffsetMs: calculateServerOffset(state.server_now, started, Date.now()) };
}

async function duelRpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await getSupabaseClient().rpc(name, args);
  if (error) throw new ArithmeticDuelRpcError(error.code, error.message);
  return data;
}

export const startArithmeticDuel = (session: ArithmeticDuelSession) => duelRpc("arithmetic_duel_host_start", { p_room: session.roomId, p_player: session.playerId, p_token: session.token });
export const tickArithmeticDuel = (session: ArithmeticDuelSession) => duelRpc("arithmetic_duel_tick", { p_room: session.roomId, p_player: session.playerId, p_token: session.token });
export const submitArithmeticAnswer = (session: ArithmeticDuelSession, roundId: string, answer: number) => duelRpc("arithmetic_duel_submit_answer", { p_room: session.roomId, p_round: roundId, p_player: session.playerId, p_token: session.token, p_answer: answer });
