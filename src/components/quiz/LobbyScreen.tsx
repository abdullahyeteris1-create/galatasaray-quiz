import type { QuizPlayer, QuizRoom } from "@/lib/quiz/types";

import { ActionButton, ArenaShell, ErrorNotice, ScreenHeader } from "./primitives";

type LobbyScreenProps = {
  room: QuizRoom;
  players: QuizPlayer[];
  currentPlayerId: string;
  error: string | null;
  starting: boolean;
  onStart: () => Promise<void>;
};

export function LobbyScreen({
  room,
  players,
  currentPlayerId,
  error,
  starting,
  onStart,
}: LobbyScreenProps) {
  const isHost = room.host_player_id === currentPlayerId;

  return (
    <ArenaShell compact>
      <ScreenHeader eyebrow="BEKLEME ODASI" title="Oyuncular Hazır mı?" />

      <div className="lobby-content">
        <ErrorNotice message={error} />

        <section className="room-code-card" aria-labelledby="room-code-heading">
          <p id="room-code-heading">ODA KODU</p>
          <strong>{room.code}</strong>
          <span>Arkadaşlarına bu kodu gönder</span>
        </section>

        <section className="player-list-section" aria-labelledby="players-heading">
          <div className="section-heading-row">
            <h2 id="players-heading">Oyuncular</h2>
            <span>{players.length} / {room.max_players}</span>
          </div>
          <ol className="player-list">
            {players.map((player, index) => (
              <li key={player.id} className={player.id === currentPlayerId ? "current-player" : ""}>
                <span className="player-avatar" aria-hidden="true">{player.name.slice(0, 1).toLocaleUpperCase("tr-TR")}</span>
                <span className="player-name">
                  {player.name}
                  {player.id === currentPlayerId && <small>Sen</small>}
                </span>
                {player.is_host && <span className="host-badge">ODA SAHİBİ</span>}
                {!player.is_host && <span className="ready-mark" aria-label="Hazır">✓</span>}
                <span className="sr-only">Sıra {index + 1}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="lobby-footer">
          {isHost ? (
            <>
              <p>En az iki oyuncu önerilir. Hazır olduğunda arenayı başlat.</p>
              <ActionButton onClick={onStart} disabled={starting}>
                {starting ? "Oyun başlatılıyor…" : "Oyunu Başlat"}
              </ActionButton>
            </>
          ) : (
            <div className="waiting-host" role="status">
              <span className="pulse-ring" aria-hidden="true" />
              <p>Oda sahibinin oyunu başlatması bekleniyor…</p>
            </div>
          )}
        </div>
      </div>
    </ArenaShell>
  );
}

