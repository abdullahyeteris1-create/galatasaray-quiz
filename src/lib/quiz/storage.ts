import type { QuizSession } from "./types";
import {
  createMultiplayerSessionStorage,
  credentialsToMultiplayerSession,
} from "@/lib/multiplayer-quiz/storage";

export const SESSION_STORAGE_KEY = "gs_quiz_session";

const sessionStorage = createMultiplayerSessionStorage<QuizSession>(SESSION_STORAGE_KEY);

export function loadSession(): QuizSession | null {
  return sessionStorage.load();
}

export function saveSession(session: QuizSession): void {
  sessionStorage.save(session);
}

export function clearSession(): void {
  sessionStorage.clear();
}

export function credentialsToSession(credentials: {
  room_id: string;
  player_id: string;
  token: string;
  code: string;
}): QuizSession {
  return credentialsToMultiplayerSession<QuizSession>(credentials);
}
