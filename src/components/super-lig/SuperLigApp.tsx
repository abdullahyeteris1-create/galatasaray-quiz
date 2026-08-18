"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useMultiplayerQuiz } from "@/components/multiplayer-quiz/useMultiplayerQuiz";
import { ActionButton, ErrorNotice, SoundControl } from "@/components/quiz/primitives";
import { toTimestamp } from "@/lib/quiz/time";
import {
  answerSuperLig,
  createSuperLigRoom,
  getSuperLigState,
  joinSuperLigRoom,
  startSuperLigGame,
  tickSuperLig,
} from "@/lib/super-lig/api";
import {
  addRecentSuperLigQuestionIds,
  clearSuperLigSession,
  credentialsToSuperLigSession,
  getRecentSuperLigQuestionIds,
  loadSuperLigSession,
  saveSuperLigSession,
} from "@/lib/super-lig/storage";
import type {
  SuperLigEra,
  SuperLigPlayer,
  SuperLigSession,
  SuperLigState,
} from "@/lib/super-lig/types";

const OPTION_LABELS = ["A", "B", "C", "D"];
const PLAYER_OPTIONS = [6, 8, 10, 12];
const QUESTION_OPTIONS = [10, 15, 20];
const ERA_OPTIONS: SuperLigEra[] = ["mixed", "2000s", "2010s", "2020s"];

const superLigLifecycleConfig = {
  sessionStore: {
    clear: clearSuperLigSession,
    load: loadSuperLigSession,
    save: saveSuperLigSession,
  },
  getState: getSuperLigState,
  hostTick: tickSuperLig,
  startGame: startSuperLigGame,
  answerQuestion: answerSuperLig,
  revealStoragePrefix: "super_lig_quiz_reveal_played",
  onReveal: (state: SuperLigState) => {
    if (state.round) addRecentSuperLigQuestionIds([String(state.round.question_id)]);
  },
};

export function SuperLigApp() {
  const router = useRouter();
  const flow = useMultiplayerQuiz<SuperLigState, SuperLigSession>(superLigLifecycleConfig);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [era, setEra] = useState<SuperLigEra>("mixed");
  const [questionCount, setQuestionCount] = useState(10);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    await flow.enterSession(
      async () => credentialsToSuperLigSession(await createSuperLigRoom(
        cleanName,
        maxPlayers,
        era,
        questionCount,
        getRecentSuperLigQuestionIds(),
      )),
      "Oda oluşturulamadı. Lütfen tekrar dene.",
    );
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanName || cleanCode.length !== 6) return;

    await flow.enterSession(
      async () => credentialsToSuperLigSession(await joinSuperLigRoom(cleanCode, cleanName)),
      "Odaya katılınamadı. Lütfen bilgileri kontrol et.",
    );
  }

  if (flow.booting) return <Loading label="Oturum kontrol ediliyor…" />;

  if (flow.screen === "home") {
    return (
      <Shell>
        <div className="super-lig-home">
          <p className="super-lig-kicker">TÜRKİYE’NİN FUTBOL ARENASI</p>
          <h1>Süper Lig<br /><span>Düello</span></h1>
          <p>2–12 oyuncu, tek saha. Futbol bilgini ve hızını kanıtla.</p>
          <ActionButton className="super-lig-primary" onClick={() => flow.navigateTo("create")}>
            Oda Oluştur
          </ActionButton>
          <ActionButton
            tone="ghost"
            className="super-lig-secondary"
            onClick={() => flow.navigateTo("join")}
          >
            Odaya Katıl
          </ActionButton>
          <button className="super-lig-menu" onClick={() => router.push("/")}>
            ← Oyun seçimine dön
          </button>
        </div>
      </Shell>
    );
  }

  if (flow.screen === "create" || flow.screen === "join") {
    const creating = flow.screen === "create";
    return (
      <Shell>
        <form className="super-lig-form" onSubmit={creating ? handleCreate : handleJoin}>
          <button type="button" className="super-lig-back" onClick={() => flow.navigateTo("home")}>
            ← Geri
          </button>
          <p className="super-lig-kicker">{creating ? "YENİ ARENA" : "ARENA’YA KATIL"}</p>
          <h1>{creating ? "Oda Oluştur" : "Odaya Katıl"}</h1>
          <ErrorNotice message={flow.actionError} />

          <label>
            Oyuncu adı
            <input
              autoComplete="nickname"
              maxLength={24}
              value={name}
              disabled={flow.pending}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          {!creating && (
            <label>
              Oda kodu
              <input
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={6}
                value={code}
                disabled={flow.pending}
                onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s/g, ""))}
                required
              />
            </label>
          )}

          {creating && (
            <>
              <ChoiceField
                legend="Maksimum oyuncu"
                options={PLAYER_OPTIONS}
                selected={maxPlayers}
                disabled={flow.pending}
                onSelect={setMaxPlayers}
              />
              <ChoiceField
                legend="Dönem"
                options={ERA_OPTIONS}
                selected={era}
                disabled={flow.pending}
                label={(value) => value === "mixed" ? "Karışık" : value}
                onSelect={setEra}
              />
              <ChoiceField
                legend="Soru sayısı"
                options={QUESTION_OPTIONS}
                selected={questionCount}
                disabled={flow.pending}
                onSelect={setQuestionCount}
              />
            </>
          )}

          <ActionButton
            type="submit"
            disabled={flow.pending || !name.trim() || (!creating && code.trim().length !== 6)}
          >
            {flow.pending ? "Hazırlanıyor…" : creating ? "Odayı Oluştur" : "Katıl"}
          </ActionButton>
        </form>
      </Shell>
    );
  }

  if (!flow.session || !flow.state) {
    return <Loading label={flow.connectionError ?? "Odaya bağlanılıyor…"} />;
  }

  if (flow.state.room.status === "finished") {
    return (
      <SuperLigFinal
        players={flow.state.players}
        currentPlayerId={flow.session.playerId}
        onHome={() => flow.resetTo("home")}
        onCreate={() => flow.resetTo("create")}
        onMenu={() => router.push("/")}
      />
    );
  }

  if (flow.state.room.status === "waiting") {
    const isHost = flow.state.room.host_player_id === flow.session.playerId;
    return (
      <Shell>
        <div className="super-lig-lobby">
          <p className="super-lig-kicker">BEKLEME ODASI</p>
          <h1>Oyuncular Hazır mı?</h1>
          <section className="super-lig-room-code">
            <span>ODA KODU</span>
            <strong>{flow.state.room.code}</strong>
          </section>
          <div className="super-lig-lobby-heading">
            <strong>Oyuncular</strong>
            <span>{flow.state.players.length} / {flow.state.room.max_players}</span>
          </div>
          <div className="super-lig-player-list">
            {flow.state.players.map((player) => (
              <div
                className={"super-lig-player " + (player.id === flow.session?.playerId ? "current-player" : "")}
                key={player.id}
              >
                <span>{player.name}</span>
                {player.id === flow.session?.playerId && <small>SEN</small>}
                {player.is_host ? <strong>ODA SAHİBİ</strong> : <strong>✓ HAZIR</strong>}
              </div>
            ))}
          </div>
          <ErrorNotice message={flow.actionError ?? flow.connectionError} />
          {isHost ? (
            <ActionButton
              disabled={flow.starting || flow.state.players.length < 2}
              onClick={flow.startGame}
            >
              {flow.starting ? "Maç başlatılıyor…" : "Maçı Başlat"}
            </ActionButton>
          ) : (
            <p className="super-lig-status">Oda sahibinin maçı başlatması bekleniyor…</p>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <SuperLigGame
      state={flow.state}
      currentPlayerId={flow.session.playerId}
      serverOffsetMs={flow.serverOffsetMs}
      selectedOption={flow.selectedOption}
      submitting={flow.submitting}
      error={flow.actionError ?? flow.connectionError}
      onAnswer={flow.answerQuestion}
    />
  );
}

function ChoiceField<Value extends string | number>({
  legend,
  options,
  selected,
  disabled,
  label = String,
  onSelect,
}: {
  legend: string;
  options: readonly Value[];
  selected: Value;
  disabled: boolean;
  label?: (value: Value) => string;
  onSelect: (value: Value) => void;
}) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {options.map((value) => (
        <button
          key={value}
          type="button"
          className={selected === value ? "chosen" : ""}
          aria-pressed={selected === value}
          disabled={disabled}
          onClick={() => onSelect(value)}
        >
          {label(value)}
        </button>
      ))}
    </fieldset>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="super-lig-shell">
      <div className="super-lig-phone">
        <SoundControl />
        {children}
      </div>
    </main>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <Shell>
      <div className="super-lig-loading" role="status" aria-live="polite">
        <span className="super-lig-stadium-mark" aria-hidden="true">⚽</span>
        <p>{label}</p>
      </div>
    </Shell>
  );
}

function SuperLigGame({
  state,
  currentPlayerId,
  serverOffsetMs,
  selectedOption,
  submitting,
  error,
  onAnswer,
}: {
  state: SuperLigState;
  currentPlayerId: string;
  serverOffsetMs: number;
  selectedOption: number | null;
  submitting: boolean;
  error: string | null;
  onAnswer: (option: number) => Promise<void>;
}) {
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  const round = state.round;
  const timing = useMemo(() => {
    if (!round) {
      return { beforeStart: true, startIn: 3, showStart: false, secondsLeft: 0, expired: false };
    }
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

  if (!round) return <Loading label="İlk soru hazırlanıyor…" />;

  if (state.reveal) {
    return (
      <SuperLigReveal
        state={state}
        currentPlayerId={currentPlayerId}
        selectedOption={selectedOption}
      />
    );
  }

  const answered = round.answered || selectedOption !== null;
  const locked = answered || submitting || timing.beforeStart || timing.expired;
  const progress = Math.min(100, Math.max(0, (timing.secondsLeft / 15) * 100));

  return (
    <Shell>
      <div className="super-lig-game">
        <header>
          <span>TUR {round.number} / {state.room.question_count}</span>
          <strong className={timing.secondsLeft <= 5 ? "urgent" : ""}>
            {timing.secondsLeft}s
          </strong>
        </header>
        <div className="super-lig-progress" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>
        <p className="super-lig-category">{round.category} · {round.difficulty}</p>
        <h1>{round.question}</h1>
        <ErrorNotice message={error} />
        <div className="super-lig-answer-grid">
          {round.options.map((option, index) => (
            <button
              key={`${round.id}-${index}`}
              type="button"
              className={selectedOption === index ? "chosen" : ""}
              disabled={locked}
              onClick={() => onAnswer(index)}
            >
              <b>{OPTION_LABELS[index]}</b>
              {option}
            </button>
          ))}
        </div>
        <div className="super-lig-status" aria-live="polite">
          {submitting && <p>Cevabın gönderiliyor…</p>}
          {answered && !submitting && <p>✓ Cevabın alındı. Diğer oyuncular bekleniyor.</p>}
          {timing.expired && !answered && <p>Süre doldu. Tur sonucu bekleniyor.</p>}
        </div>
        {(timing.beforeStart || timing.showStart) && (
          <div className="super-lig-countdown" role="status" aria-live="assertive">
            <p>HAZIR OL</p>
            <strong>{timing.beforeStart ? timing.startIn : "BAŞLA!"}</strong>
          </div>
        )}
      </div>
    </Shell>
  );
}

function SuperLigReveal({
  state,
  currentPlayerId,
  selectedOption,
}: {
  state: SuperLigState;
  currentPlayerId: string;
  selectedOption: number | null;
}) {
  const round = state.round;
  const reveal = state.reveal;
  if (!round || !reveal) return <Loading label="Tur sonucu hazırlanıyor…" />;

  const leaderboard = sortPlayers(state.players);
  const winner = state.players.find((player) => player.id === reveal.winner_id);
  const isCorrect = selectedOption === reveal.correct_option;

  return (
    <Shell>
      <div className="super-lig-reveal" aria-live="polite">
        <p className="super-lig-kicker">TUR {round.number} SONUCU</p>
        <h1>{winner ? `${winner.name} turu kazandı` : "Bu turda puan yok"}</h1>
        <p className={isCorrect ? "super-lig-result-correct" : ""}>
          Doğru cevap: <strong>{OPTION_LABELS[reveal.correct_option]}</strong>
        </p>
        <div className="super-lig-reveal-options">
          {round.options.map((option, index) => (
            <div
              key={`${round.id}-${index}`}
              className={
                index === reveal.correct_option
                  ? "correct"
                  : index === selectedOption
                    ? "wrong"
                    : ""
              }
            >
              <b>{OPTION_LABELS[index]}</b>
              <span>{option}</span>
            </div>
          ))}
        </div>
        <p>{reveal.explanation}</p>
        <ol className={`super-lig-scoreboard ${leaderboard.length === 2 ? "two-player" : ""}`}>
          {leaderboard.map((player, index) => {
            const answer = reveal.answers.find((item) => item.player_id === player.id);
            return (
              <li key={player.id} className={player.id === currentPlayerId ? "current-player" : ""}>
                <span>{index + 1}</span>
                <strong>{player.name}{player.id === currentPlayerId ? " · SEN" : ""}</strong>
                <small>
                  {!answer ? "Cevap yok" : answer.is_correct
                    ? `✓ ${(answer.response_ms / 1000).toFixed(2)} sn`
                    : "Yanlış"}
                </small>
                <b>{player.score}</b>
              </li>
            );
          })}
        </ol>
        <p className="super-lig-next-round">Sonraki soru hazırlanıyor…</p>
      </div>
    </Shell>
  );
}

function SuperLigFinal({
  players,
  currentPlayerId,
  onHome,
  onCreate,
  onMenu,
}: {
  players: SuperLigPlayer[];
  currentPlayerId: string;
  onHome: () => void;
  onCreate: () => void;
  onMenu: () => void;
}) {
  const leaderboard = sortPlayers(players);
  const winner = leaderboard[0];

  return (
    <Shell>
      <div className="super-lig-final">
        <p className="super-lig-kicker">MAÇ BİTTİ</p>
        <h1>{winner?.name ?? "Şampiyon"}</h1>
        <p>{winner?.score ?? 0} puan ile arenayı tamamladı.</p>
        <ol className="super-lig-scoreboard">
          {leaderboard.map((player, index) => (
            <li key={player.id} className={player.id === currentPlayerId ? "current-player" : ""}>
              <span>{index + 1}</span>
              <strong>{player.name}{player.id === currentPlayerId ? " · SEN" : ""}</strong>
              <small>{player.correct} doğru</small>
              <b>{player.score}</b>
            </li>
          ))}
        </ol>
        <ActionButton onClick={onCreate}>Yeni Oda Kur</ActionButton>
        <ActionButton tone="ghost" className="super-lig-secondary" onClick={onHome}>
          Ana Sayfa
        </ActionButton>
        <button className="super-lig-menu" onClick={onMenu}>Oyun seçimine dön</button>
      </div>
    </Shell>
  );
}

function sortPlayers(players: SuperLigPlayer[]) {
  return [...players].sort(
    (a, b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name, "tr"),
  );
}
