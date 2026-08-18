import type { MultiplayerCredentials, MultiplayerSession } from "./types";

function isMultiplayerSession(value: unknown): value is MultiplayerSession {
  if (!value || typeof value !== "object") return false;

  const session = value as Partial<MultiplayerSession>;
  return session.version === 1 && [session.roomId, session.playerId, session.token, session.code].every(
    (item) => typeof item === "string" && item.length > 0,
  );
}

export function createMultiplayerSessionStorage<Session extends MultiplayerSession>(key: string) {
  function clear(): void {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  }

  function load(): Session | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) return null;

      const parsed: unknown = JSON.parse(stored);
      if (!isMultiplayerSession(parsed)) {
        clear();
        return null;
      }

      return parsed as Session;
    } catch {
      clear();
      return null;
    }
  }

  function save(session: Session): void {
    window.localStorage.setItem(key, JSON.stringify(session));
  }

  return { clear, load, save };
}

export function credentialsToMultiplayerSession<Session extends MultiplayerSession>(
  credentials: MultiplayerCredentials,
): Session {
  return {
    version: 1,
    roomId: credentials.room_id,
    playerId: credentials.player_id,
    token: credentials.token,
    code: credentials.code,
  } as Session;
}
