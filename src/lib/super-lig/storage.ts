import type { SuperLigSession } from "./types";
import {
  createMultiplayerSessionStorage,
  credentialsToMultiplayerSession,
} from "@/lib/multiplayer-quiz/storage";

export const SUPER_LIG_SESSION_STORAGE_KEY = "super_lig_quiz_session";
export const SUPER_LIG_RECENT_QUESTION_IDS_KEY = "super_lig_recent_question_ids";
export const SUPER_LIG_RECENT_QUESTION_LIMIT = 50;

export function getRecentSuperLigQuestionIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SUPER_LIG_RECENT_QUESTION_IDS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === "string"))].slice(-SUPER_LIG_RECENT_QUESTION_LIMIT);
  } catch { return []; }
}

export function addRecentSuperLigQuestionIds(ids: string[]) {
  if (typeof window === "undefined") return;
  const merged = [...getRecentSuperLigQuestionIds(), ...ids];
  window.localStorage.setItem(SUPER_LIG_RECENT_QUESTION_IDS_KEY, JSON.stringify([...new Set(merged)].slice(-SUPER_LIG_RECENT_QUESTION_LIMIT)));
}

const sessionStorage = createMultiplayerSessionStorage<SuperLigSession>(SUPER_LIG_SESSION_STORAGE_KEY);

export function loadSuperLigSession(): SuperLigSession | null {
  return sessionStorage.load();
}

export function saveSuperLigSession(session: SuperLigSession) {
  sessionStorage.save(session);
}

export function clearSuperLigSession() {
  sessionStorage.clear();
}

export function credentialsToSuperLigSession(credentials: SuperLigCredentialsLike): SuperLigSession {
  return credentialsToMultiplayerSession<SuperLigSession>(credentials);
}

type SuperLigCredentialsLike = {
  room_id: string;
  player_id: string;
  token: string;
  code: string;
};
