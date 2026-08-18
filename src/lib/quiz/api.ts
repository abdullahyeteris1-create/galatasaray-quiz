import {
  getSyncedMultiplayerState,
  multiplayerRpc,
  multiplayerRpcVoid,
} from "@/lib/multiplayer-quiz/api";
import type {
  QuizState,
  RoomCredentials,
  SyncedQuizState,
} from "./types";

export function createRoom(
  name: string,
  maxPlayers: number,
  questionCount: number,
): Promise<RoomCredentials> {
  return multiplayerRpc<RoomCredentials>("quiz_create_room", {
    p_name: name,
    p_max_players: maxPlayers,
    p_question_count: questionCount,
  });
}

export function joinRoom(code: string, name: string): Promise<RoomCredentials> {
  return multiplayerRpc<RoomCredentials>("quiz_join_room", {
    p_code: code,
    p_name: name,
  });
}

export async function getQuizState(
  roomId: string,
  playerId: string,
  token: string,
): Promise<SyncedQuizState> {
  return getSyncedMultiplayerState<QuizState>("quiz_get_state", {
    p_room: roomId,
    p_player: playerId,
    p_token: token,
  });
}

export async function startGame(
  roomId: string,
  playerId: string,
  token: string,
): Promise<void> {
  await multiplayerRpcVoid("quiz_host_start", {
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
  await multiplayerRpcVoid("quiz_host_tick", {
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
  await multiplayerRpcVoid("quiz_player_answer", {
    p_room: roomId,
    p_round: roundId,
    p_player: playerId,
    p_token: token,
    p_selected: selected,
  });
}
