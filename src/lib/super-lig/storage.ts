import type { SuperLigSession } from "./types";

export const SUPER_LIG_SESSION_STORAGE_KEY = "super_lig_quiz_session";

function isSession(value: unknown): value is SuperLigSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<SuperLigSession>;
  return session.version === 1 && [session.roomId, session.playerId, session.token, session.code].every(
    (item) => typeof item === "string" && item.length > 0,
  );
}

export function loadSuperLigSession(): SuperLigSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SUPER_LIG_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSuperLigSession(session: SuperLigSession) {
  window.localStorage.setItem(SUPER_LIG_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSuperLigSession() {
  if (typeof window !== "undefined") window.localStorage.removeItem(SUPER_LIG_SESSION_STORAGE_KEY);
}

export function credentialsToSuperLigSession(credentials: SuperLigCredentialsLike): SuperLigSession {
  return {
    version: 1,
    roomId: credentials.room_id,
    playerId: credentials.player_id,
    token: credentials.token,
    code: credentials.code,
  };
}

type SuperLigCredentialsLike = {
  room_id: string;
  player_id: string;
  token: string;
  code: string;
};
