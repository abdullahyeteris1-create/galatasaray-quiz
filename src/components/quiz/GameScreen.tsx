"use client";

import { useEffect, useMemo, useState } from "react";

import { toTimestamp } from "@/lib/quiz/time";
import type { QuizPlayer, QuizReveal, QuizRound } from "@/lib/quiz/types";

import { RoundReveal } from "./RoundReveal";
import { ArenaShell, ErrorNotice } from "./primitives";

type GameScreenProps = {
  round: QuizRound | null;
  reveal: QuizReveal | null;
  players: QuizPlayer[];
  currentPlayerId: string;
  totalQuestions: number;
  serverOffsetMs: number;
  selectedOption: number | null;
  submitting: boolean;
  error: string | null;
  onAnswer: (option: number) => Promise<void>;
};

const OPTION_LABELS = ["A", "B", "C", "D"];

export function GameScreen({
  round,
  reveal,
  players,
  currentPlayerId,
  totalQuestions,
  serverOffsetMs,
  selectedOption,
  submitting,
  error,
  onAnswer,
}: GameScreenProps) {
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  const timing = useMemo(() => {
    if (!round) return { beforeStart: true, startIn: 3, showStart: false, secondsLeft: 0, expired: false };
    const now = clock + serverOffsetMs;
    const startDelta = toTimestamp(round.starts_at) - now;
    const endDelta = toTimestamp(round.ends_at) - now;

    return {
      beforeStart: startDelta > 0,
      startIn: Math.max(1, Math.min(3, Math.ceil(startDelta / 1000))),
      showStart: startDelta <= 0 && startDelta > -700,
      secondsLeft: Math.max(0, Math.ceil(endDelta / 1000)),
      expired: endDelta <= 0,
    };
  }, [clock, round, serverOffsetMs]);

  if (!round) {
    return (
      <ArenaShell>
        <div className="between-rounds" role="status" aria-live="polite">
          <span aria-hidden="true">1905</span>
          <h1>İlk soru hazırlanıyor</h1>
          <p>Arena birazdan açılacak…</p>
        </div>
      </ArenaShell>
    );
  }

  if (reveal) {
    return (
      <RoundReveal
        round={round}
        reveal={reveal}
        players={players}
        currentPlayerId={currentPlayerId}
        selectedOption={selectedOption}
        totalQuestions={totalQuestions}
      />
    );
  }

  const answered = round.answered || selectedOption !== null;
  const locked = answered || submitting || timing.beforeStart || timing.expired;
  const progress = Math.min(100, Math.max(0, (timing.secondsLeft / 15) * 100));

  return (
    <ArenaShell compact>
      <div className="game-screen">
        <header className="game-topbar">
          <p>SORU <strong>{round.number}</strong> / {totalQuestions}</p>
          <div className={`game-timer ${timing.secondsLeft <= 5 ? "urgent" : ""}`}>
            <span>{timing.secondsLeft}</span> sn
          </div>
        </header>
        <div className="timer-track" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>

        <div className="question-meta">
          <span>{round.category}</span>
          <span>{round.difficulty}</span>
        </div>

        <section className="question-card" aria-labelledby="question-heading">
          <h1 id="question-heading">{round.question}</h1>
        </section>

        <ErrorNotice message={error} />

        <div className="answer-grid" aria-label="Cevap seçenekleri">
          {round.options.map((option, index) => (
            <button
              key={`${round.id}-${index}`}
              className={selectedOption === index ? "selected" : ""}
              type="button"
              disabled={locked}
              onClick={() => onAnswer(index)}
            >
              <span>{OPTION_LABELS[index] ?? index + 1}</span>
              <p>{option}</p>
              {selectedOption === index && <strong aria-hidden="true">✓</strong>}
            </button>
          ))}
        </div>

        <div className="answer-status" aria-live="polite">
          {submitting && <p>Cevabın gönderiliyor…</p>}
          {answered && !submitting && <p><span aria-hidden="true">✓</span> Cevabın alındı. Diğer oyuncular bekleniyor.</p>}
          {timing.expired && !answered && <p>Süre doldu. Tur sonucu bekleniyor.</p>}
        </div>

        {(timing.beforeStart || timing.showStart) && (
          <div className="countdown-overlay" role="status" aria-live="assertive" aria-atomic="true">
            <p>HAZIR OL</p>
            <strong>{timing.beforeStart ? timing.startIn : "BAŞLA!"}</strong>
          </div>
        )}
      </div>
    </ArenaShell>
  );
}
