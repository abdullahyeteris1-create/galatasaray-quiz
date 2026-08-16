import type { QuizPlayer } from "@/lib/quiz/types";

import { ActionButton, ArenaShell, BrandMark } from "./primitives";

type FinalScreenProps = {
  players: QuizPlayer[];
  currentPlayerId: string;
  onHome: () => void;
  onCreateRoom: () => void;
};

export function FinalScreen({ players, currentPlayerId, onHome, onCreateRoom }: FinalScreenProps) {
  const leaderboard = [...players].sort(
    (a, b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name, "tr"),
  );
  const winner = leaderboard[0];

  return (
    <ArenaShell compact>
      <div className="final-screen">
        <BrandMark small />
        <section className="winner-card">
          <span className="trophy" aria-hidden="true">♛</span>
          <p>ARENA ŞAMPİYONU</p>
          <h1>{winner?.name ?? "Şampiyon"}</h1>
          {winner && <strong>{winner.score.toLocaleString("tr-TR")} PUAN</strong>}
        </section>

        <section className="final-ranking" aria-labelledby="final-ranking-heading">
          <div className="section-heading-row">
            <h2 id="final-ranking-heading">Final Sıralaması</h2>
            <span>{players.length} OYUNCU</span>
          </div>
          <ol>
            {leaderboard.map((player, index) => (
              <li key={player.id} className={player.id === currentPlayerId ? "current-player" : ""}>
                <span className={`rank rank-${index + 1}`}>{index + 1}</span>
                <span className="leader-name">
                  {player.name}
                  {player.id === currentPlayerId && <small> SEN</small>}
                </span>
                <span className="final-stats"><strong>{player.score.toLocaleString("tr-TR")}</strong><small>{player.correct} doğru</small></span>
              </li>
            ))}
          </ol>
        </section>

        <div className="final-actions">
          <ActionButton onClick={onCreateRoom}>Yeni Oda Kur</ActionButton>
          <ActionButton tone="ghost" onClick={onHome}>Ana Sayfa</ActionButton>
        </div>
      </div>
    </ArenaShell>
  );
}
