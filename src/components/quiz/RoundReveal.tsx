import type { QuizPlayer, QuizReveal, QuizRound } from "@/lib/quiz/types";

import { ArenaShell } from "./primitives";

type RoundRevealProps = {
  round: QuizRound;
  reveal: QuizReveal;
  players: QuizPlayer[];
  currentPlayerId: string;
  selectedOption: number | null;
  totalQuestions: number;
};

const OPTION_LABELS = ["A", "B", "C", "D"];

export function RoundReveal({
  round,
  reveal,
  players,
  currentPlayerId,
  selectedOption,
  totalQuestions,
}: RoundRevealProps) {
  const leaderboard = [...players].sort(
    (a, b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name, "tr"),
  );
  const isCorrect = selectedOption === reveal.correct_option;

  return (
    <ArenaShell compact>
      <div className="reveal-screen" aria-live="polite">
        <header className="game-topbar">
          <p>SORU <strong>{round.number}</strong> / {totalQuestions}</p>
          <span className="round-finished">TUR BİTTİ</span>
        </header>

        <section className={`result-banner ${isCorrect ? "result-correct" : "result-neutral"}`}>
          <span className="result-icon" aria-hidden="true">{isCorrect ? "✓" : selectedOption === null ? "–" : "×"}</span>
          <div>
            <p>{isCorrect ? "DOĞRU CEVAP" : selectedOption === null ? "SÜRE DOLDU" : "BU KEZ OLMADI"}</p>
            <h1>{isCorrect ? "Harika bildin!" : "Doğru cevabı gör"}</h1>
          </div>
        </section>

        <section className="reveal-answer" aria-label="Soru sonucu">
          <p className="reveal-question">{round.question}</p>
          <div className="reveal-options">
            {round.options.map((option, index) => {
              const isAnswer = index === reveal.correct_option;
              const isWrongSelection = index === selectedOption && !isAnswer;
              return (
                <div
                  key={`${round.id}-${index}`}
                  className={`reveal-option ${isAnswer ? "correct" : ""} ${isWrongSelection ? "wrong" : ""}`}
                >
                  <span>{OPTION_LABELS[index] ?? index + 1}</span>
                  <p>{option}</p>
                  {isAnswer && <strong aria-label="Doğru cevap">✓</strong>}
                  {isWrongSelection && <strong aria-label="Senin yanlış cevabın">×</strong>}
                </div>
              );
            })}
          </div>
          <div className="explanation-card">
            <span aria-hidden="true">i</span>
            <p>{reveal.explanation}</p>
          </div>
        </section>

        <section className="leaderboard" aria-labelledby="live-ranking-heading">
          <div className="section-heading-row">
            <h2 id="live-ranking-heading">Canlı Sıralama</h2>
            <span>SONRAKİ SORU HAZIRLANIYOR</span>
          </div>
          <ol>
            {leaderboard.map((player, index) => (
              <li key={player.id} className={player.id === currentPlayerId ? "current-player" : ""}>
                <span className={`rank rank-${index + 1}`}>{index + 1}</span>
                <span className="leader-name">{player.name}{player.id === currentPlayerId && <small> SEN</small>}</span>
                <strong>{player.score.toLocaleString("tr-TR")}</strong>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </ArenaShell>
  );
}

