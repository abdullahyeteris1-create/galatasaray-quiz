import {
  getSyncedMultiplayerState,
  multiplayerRpc,
  multiplayerRpcVoid,
} from "@/lib/multiplayer-quiz/api";

import type { SuperLigState, SyncedSuperLigState, SuperLigCredentials, SuperLigEra } from "./types";

export function createSuperLigRoom(
  name: string,
  maxPlayers: number,
  era: SuperLigEra,
  questionCount: number,
  excludeQuestionIds: string[] = [],
) {
  const ids = excludeQuestionIds.slice(-50).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0);
  return multiplayerRpc<SuperLigCredentials>("quiz_super_lig_create_room_v4", {
    p_name: name,
    p_max_players: maxPlayers,
    p_era: era,
    p_question_count: questionCount,
    p_exclude_question_ids: ids,
  });
}

export function joinSuperLigRoom(code: string, name: string) {
  return multiplayerRpc<SuperLigCredentials>("quiz_super_lig_join_room", { p_code: code, p_name: name });
}

export async function getSuperLigState(roomId: string, playerId: string, token: string): Promise<SyncedSuperLigState> {
  return getSyncedMultiplayerState<SuperLigState>("quiz_super_lig_get_state", {
    p_room: roomId,
    p_player: playerId,
    p_token: token,
  });
}

export function startSuperLigGame(roomId: string, playerId: string, token: string) {
  return multiplayerRpcVoid("quiz_super_lig_host_start", { p_room: roomId, p_player: playerId, p_token: token });
}

export function tickSuperLig(roomId: string, playerId: string, token: string) {
  return multiplayerRpcVoid("quiz_super_lig_tick", { p_room: roomId, p_player: playerId, p_token: token });
}

export function answerSuperLig(roomId: string, roundId: string, playerId: string, token: string, selected: number) {
  return multiplayerRpcVoid("quiz_super_lig_player_answer", {
    p_room: roomId,
    p_round: roundId,
    p_player: playerId,
    p_token: token,
    p_selected: selected,
  });
}
