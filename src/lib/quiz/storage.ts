import type { QuizSession } from "./types";

export const SESSION_STORAGE_KEY = "gs_quiz_session";

function isQuizSession(value: unknown): value is QuizSession {
  if (!value || typeof value !== "object") return false;

  const session = value as Partial<QuizSession>;
  return session.version === 1 && [session.roomId, session.playerId, session.token, session.code].every(
    (item) => typeof item === "string" && item.length > 0,
  );
}

export function loadSession(): QuizSession | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (!isQuizSession(parsed)) {
      clearSession();
      return null;
    }

    return parsed;
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(session: QuizSession): void {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

export function credentialsToSession(credentials: {
  room_id: string;
  player_id: string;
  token: string;
  code: string;
}): QuizSession {
  return {
    version: 1,
    roomId: credentials.room_id,
    playerId: credentials.player_id,
    token: credentials.token,
    code: credentials.code,
  };
}
