"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArithmeticDuelRpcError, createArithmeticRoom, getArithmeticState, joinArithmeticRoom, startArithmeticDuel, submitArithmeticAnswer, tickArithmeticDuel, type ArithmeticPlayer, type ArithmeticState } from "@/lib/arithmetic-duel/api";
import { ARITHMETIC_DIFFICULTIES, ARITHMETIC_OPERATIONS, ARITHMETIC_ROUNDS, ARITHMETIC_TIMES, type ArithmeticDifficulty, type ArithmeticDuelSession, type ArithmeticOperation, type ArithmeticRoundCount, type ArithmeticTimeLimit } from "@/lib/arithmetic-duel/config";

const SESSION_KEY = "gs_arithmetic_duel_session";
type Screen = "home" | "setup" | "join" | "lobby" | "game" | "final";

function formatError(error: unknown) {
  if (error instanceof ArithmeticDuelRpcError) {
    const messages: Record<string, string> = { ROOM_NOT_FOUND: "Oda bulunamadı.", ROOM_FULL: "Oda dolu.", NAME_TAKEN: "Bu isim odada kullanılıyor.", NEED_2_PLAYERS: "Başlamak için en az iki oyuncu gerekli.", HOST_ONLY: "Bu işlemi yalnızca oda sahibi yapabilir.", ANSWER_ALREADY_SUBMITTED: "Bu turda cevap hakkını zaten kullandın.", ROUND_CLOSED: "Bu tur sona erdi.", ROUND_EXPIRED: "Süren doldu.", INVALID_ROOM_OPTIONS: "Seçenekler geçersiz.", UNAUTHORIZED_PLAYER: "Oda oturumun geçerli değil." };
    return messages[error.code ?? ""] ?? "Oyun sunucusundan yanıt alınamadı.";
  }
  return error instanceof Error ? error.message : "Bir hata oluştu.";
}

function readSession(value: string | null): ArithmeticDuelSession | null {
  if (!value) return null;
  try {
    const session = JSON.parse(value) as Partial<ArithmeticDuelSession>;
    if ([session.roomId, session.playerId, session.token, session.code].every((item) => typeof item === "string" && item.length > 0)) return session as ArithmeticDuelSession;
  } catch { /* stale local storage */ }
  return null;
}

export function ArithmeticDuel() {
  const [screen, setScreen] = useState<Screen>("home");
  const [session, setSession] = useState<ArithmeticDuelSession | null>(null);
  const [state, setState] = useState<ArithmeticState | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [difficulty, setDifficulty] = useState<ArithmeticDifficulty>(1);
  const [operation, setOperation] = useState<ArithmeticOperation>("mixed");
  const [rounds, setRounds] = useState<ArithmeticRoundCount>(10);
  const [timeLimit, setTimeLimit] = useState<ArithmeticTimeLimit>(10);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(0);
  const pollingRef = useRef(false);
  const tickRef = useRef(false);
  const roomStatus = state?.room.status;
  const hostPlayerId = state?.room.host_player_id;

  useEffect(() => { setSession(readSession(window.localStorage.getItem(SESSION_KEY))); }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); setNow(Date.now()); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let timer: number | null = null;
    const poll = async () => {
      if (cancelled) return;
      if (pollingRef.current) { timer = window.setTimeout(() => void poll(), 100); return; }
      pollingRef.current = true;
      try {
        const result = await getArithmeticState(session);
        if (cancelled) return;
        setState(result.state); setOffset(result.serverOffsetMs); setError("");
        setScreen(result.state.room.status === "waiting" ? "lobby" : result.state.room.status === "finished" ? "final" : "game");
        if (result.state.room.status !== "finished") timer = window.setTimeout(() => void poll(), result.state.room.status === "waiting" ? 1200 : 750);
      } catch (caught) {
        if (!cancelled) {
          if (caught instanceof ArithmeticDuelRpcError && caught.code === "UNAUTHORIZED_PLAYER") { window.localStorage.removeItem(SESSION_KEY); setSession(null); setState(null); setScreen("home"); }
          else { setError(formatError(caught)); timer = window.setTimeout(() => void poll(), 2000); }
        }
      } finally { pollingRef.current = false; }
    };
    void poll();
    return () => { cancelled = true; if (timer !== null) window.clearTimeout(timer); };
  }, [session]);

  useEffect(() => {
    if (!session || roomStatus !== "playing" || hostPlayerId !== session.playerId) return;
    let cancelled = false;
    const run = async () => {
      if (!cancelled && !tickRef.current) { tickRef.current = true; try { await tickArithmeticDuel(session); } catch { /* polling reports terminal state */ } finally { tickRef.current = false; } }
      if (!cancelled) window.setTimeout(() => void run(), 1000);
    };
    void run();
    return () => { cancelled = true; };
  }, [session, roomStatus, hostPlayerId]);

  async function enter(request: Promise<{ room_id: string; player_id: string; token: string; code: string }>) {
    setBusy(true); setError("");
    try { const result = await request; const next = { roomId: result.room_id, playerId: result.player_id, token: result.token, code: result.code }; window.localStorage.setItem(SESSION_KEY, JSON.stringify(next)); setSession(next); }
    catch (caught) { setError(formatError(caught)); } finally { setBusy(false); }
  }
  async function hostStart() { if (!session) return; setBusy(true); try { await startArithmeticDuel(session); } catch (caught) { setError(formatError(caught)); } finally { setBusy(false); } }
  function leave() { window.localStorage.removeItem(SESSION_KEY); setSession(null); setState(null); setScreen("home"); setAnswer(""); setFeedback(""); }
  function appendDigit(value: string) { if (answer.length < 7) setAnswer((current) => current + value); }
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!session || !state?.round || state.round.answered_by_me || !answer.trim() || busy) return;
    const parsedAnswer = Number(answer);
    if (!Number.isInteger(parsedAnswer)) return;
    setBusy(true); setFeedback("");
    try { const result = await submitArithmeticAnswer(session, state.round.id, parsedAnswer); const value = result as { is_correct?: boolean }; setFeedback(value.is_correct ? "✓ Hızlı ve doğru!" : "Yanlış! Bu turdaki cevap hakkını kullandın."); setAnswer(""); }
    catch (caught) { setFeedback(formatError(caught)); } finally { setBusy(false); }
  }

  if (screen === "home" || (!session && screen !== "setup" && screen !== "join")) return <DuelShell><div className="duel-hero"><Link href="/" className="duel-back">← Ana Menü</Link><div className="duel-orb" aria-hidden="true">±</div><p className="duel-kicker">ONLINE MULTIPLAYER</p><h1>MENTAL<br /><span>ARİTMETİK DÜELLOSU</span></h1><p>Aynı işlemi arkadaşlarından önce çöz, hızını göster.</p><div className="duel-actions"><button onClick={() => setScreen("setup")}>ODA OLUŞTUR</button><button className="duel-secondary" onClick={() => setScreen("join")}>ODAYA KATIL</button></div></div></DuelShell>;
  if (screen === "setup") return <DuelShell><Setup name={name} setName={setName} difficulty={difficulty} setDifficulty={setDifficulty} operation={operation} setOperation={setOperation} rounds={rounds} setRounds={setRounds} timeLimit={timeLimit} setTimeLimit={setTimeLimit} maxPlayers={maxPlayers} setMaxPlayers={setMaxPlayers} busy={busy} error={error} onBack={() => setScreen("home")} onSubmit={() => void enter(createArithmeticRoom(name, maxPlayers, difficulty, operation, rounds, timeLimit))} /></DuelShell>;
  if (screen === "join") return <DuelShell><div className="duel-panel"><button className="duel-back" onClick={() => setScreen("home")}>← Geri</button><p className="duel-kicker">ODA KODU</p><h2>Düelloya katıl</h2><input className="duel-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Oyuncu adın" maxLength={24} /><input className="duel-input duel-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="6 karakterli oda kodu" maxLength={6} /><button className="duel-primary" disabled={!name.trim() || code.length !== 6 || busy} onClick={() => void enter(joinArithmeticRoom(code, name))}>ODAYA KATIL</button>{error && <p className="duel-error">{error}</p>}</div></DuelShell>;
  if (!state || !session) return <DuelShell><div className="duel-panel"><p>Oyun durumu hazırlanıyor…</p></div></DuelShell>;
  if (screen === "lobby") return <DuelShell><Lobby state={state} session={session} onStart={() => void hostStart()} onLeave={leave} busy={busy} /></DuelShell>;
  if (screen === "final") return <DuelShell><Final state={state} onLeave={leave} /></DuelShell>;
  return <DuelShell><Game state={state} session={session} now={now + offset} answer={answer} feedback={feedback} busy={busy} onAnswer={setAnswer} onDigit={appendDigit} onClear={() => setAnswer("")} onSubmit={submit} onLeave={leave} /></DuelShell>;
}

function DuelShell({ children }: { children: React.ReactNode }) { return <main className="arithmetic-duel-page"><section className="arithmetic-duel-shell">{children}</section></main>; }
function Setup({ name, setName, difficulty, setDifficulty, operation, setOperation, rounds, setRounds, timeLimit, setTimeLimit, maxPlayers, setMaxPlayers, busy, error, onBack, onSubmit }: { name: string; setName: (value: string) => void; difficulty: ArithmeticDifficulty; setDifficulty: (value: ArithmeticDifficulty) => void; operation: ArithmeticOperation; setOperation: (value: ArithmeticOperation) => void; rounds: ArithmeticRoundCount; setRounds: (value: ArithmeticRoundCount) => void; timeLimit: ArithmeticTimeLimit; setTimeLimit: (value: ArithmeticTimeLimit) => void; maxPlayers: number; setMaxPlayers: (value: number) => void; busy: boolean; error: string; onBack: () => void; onSubmit: () => void }) {
  return <div className="duel-panel"><button className="duel-back" onClick={onBack}>← Geri</button><p className="duel-kicker">YENİ DÜELLO</p><h2>Odanı hazırla</h2><input className="duel-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Oyuncu adın" maxLength={24} /><Choice label="Oyuncu sayısı" values={[2, 4, 6, 8]} selected={maxPlayers} onChange={(value) => setMaxPlayers(value as number)} /><Choice label="Zorluk" values={ARITHMETIC_DIFFICULTIES} selected={difficulty} onChange={(value) => setDifficulty(value as ArithmeticDifficulty)} /><Choice label="İşlem" values={ARITHMETIC_OPERATIONS} selected={operation} onChange={(value) => setOperation(value as ArithmeticOperation)} /><Choice label="Tur" values={ARITHMETIC_ROUNDS} selected={rounds} suffix="tur" onChange={(value) => setRounds(value as ArithmeticRoundCount)} /><Choice label="Süre / soru" values={ARITHMETIC_TIMES} selected={timeLimit} suffix="sn" onChange={(value) => setTimeLimit(value as ArithmeticTimeLimit)} /><button className="duel-primary" disabled={!name.trim() || busy} onClick={onSubmit}>{busy ? "ODA HAZIRLANIYOR…" : "ODA OLUŞTUR"}</button>{error && <p className="duel-error">{error}</p>}</div>;
}
function Choice({ label, values, selected, suffix, onChange }: { label: string; values: Array<number | string | { value: number | string; label: string }>; selected: number | string; suffix?: string; onChange: (value: number | string) => void }) { return <fieldset className="duel-choice"><legend>{label}</legend><div>{values.map((item) => { const value = typeof item === "object" ? item.value : item; const text = typeof item === "object" ? item.label : `${item}${suffix ? ` ${suffix}` : ""}`; return <button type="button" key={String(value)} className={selected === value ? "selected" : ""} onClick={() => onChange(value)}>{text}</button>; })}</div></fieldset>; }
function Lobby({ state, session, onStart, onLeave, busy }: { state: ArithmeticState; session: ArithmeticDuelSession; onStart: () => void; onLeave: () => void; busy: boolean }) { const host = state.room.host_player_id === session.playerId; return <div className="duel-panel"><p className="duel-kicker">MENTAL ARİTMETİK DÜELLOSU</p><h2>Oda: {state.room.code}</h2><p className="duel-muted">{state.players.length} / {state.room.max_players} oyuncu</p><div className="duel-players">{state.players.map((player) => <div key={player.id} className={player.id === session.playerId ? "mine" : ""}><span>{player.id === session.playerId ? "👑" : "○"} {player.name}</span>{player.is_host && <small>HOST</small>}</div>)}</div>{host ? <button className="duel-primary" disabled={state.players.length < 2 || busy} onClick={onStart}>DÜELLOYU BAŞLAT</button> : <p className="duel-muted">Oda sahibinin başlatması bekleniyor…</p>}<button className="duel-link" onClick={onLeave}>Odadan çık</button></div>; }
function Game({ state, session, now, answer, feedback, busy, onAnswer, onDigit, onClear, onSubmit, onLeave }: { state: ArithmeticState; session: ArithmeticDuelSession; now: number; answer: string; feedback: string; busy: boolean; onAnswer: (value: string) => void; onDigit: (value: string) => void; onClear: () => void; onSubmit: (event?: FormEvent) => void; onLeave: () => void }) {
  const round = state.round; const player = state.players.find((item) => item.id === session.playerId); const beforeStart = !!round && Date.parse(round.starts_at) > now; const expired = !!round && Date.parse(round.ends_at) <= now; const answered = round?.answered_by_me ?? false; const locked = !round || beforeStart || expired || answered || busy;
  const seconds = round ? Math.max(0, Math.ceil((Date.parse(round.ends_at) - now) / 1000)) : 0;
  const countdown = round ? Math.max(1, Math.ceil((Date.parse(round.starts_at) - now) / 1000)) : 0;
  return <div className="duel-panel duel-game"><div className="duel-game-top"><span>TUR {state.room.current_round} / {state.room.round_count}</span><b className={seconds <= 3 ? "urgent" : ""}>{beforeStart ? countdown : `${seconds}s`}</b></div><div className="duel-timer" aria-label={beforeStart ? `${countdown} saniye içinde başlıyor` : `${seconds} saniye kaldı`}><span>{beforeStart ? countdown : seconds}</span></div>{round?.finished_at ? <div className="duel-reveal"><p>DOĞRU CEVAP</p><strong>{round.correct_answer}</strong><span>{round.winner_name ? `🏆 ${round.winner_name} kazandı` : "Bu turu kimse kazanamadı."}</span></div> : <><p className="duel-question">{round?.question_text ?? "Yeni soru hazırlanıyor…"}</p><form onSubmit={onSubmit}><input className="duel-answer" inputMode="numeric" pattern="[0-9-]*" value={answer} onChange={(event) => onAnswer(event.target.value.replace(/[^0-9-]/g, ""))} placeholder="Cevabın" disabled={locked} aria-label="Cevap" /><div className="duel-keypad">{["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "C"].map((key) => <button type="button" key={key} onClick={() => key === "C" ? onClear() : key === "⌫" ? onAnswer(answer.slice(0, -1)) : onDigit(key)} disabled={locked}>{key}</button>)}</div><button className="duel-primary" disabled={locked || !answer.trim() || !Number.isInteger(Number(answer))} type="submit">CEVABI GÖNDER</button></form>{feedback && <p className={feedback.startsWith("✓") ? "duel-success" : "duel-error"}>{feedback}</p>}</>}<p className="duel-muted">{player?.name} · {player?.score ?? 0} puan</p><Leaderboard players={state.players} me={session.playerId} /><button className="duel-link" onClick={onLeave}>Oyundan çık</button></div>;
}
function Leaderboard({ players, me }: { players: ArithmeticPlayer[]; me: string }) { return <div className="duel-leaderboard">{players.map((player, index) => <div key={player.id} className={player.id === me ? "mine" : ""}><b>{index + 1}</b><span>{player.name}<small>{player.round_wins} tur galibiyeti · {player.correct} doğru · {player.wrong} yanlış</small></span><strong>{player.score}</strong></div>)}</div>; }
function Final({ state, onLeave }: { state: ArithmeticState; onLeave: () => void }) { return <div className="duel-panel"><p className="duel-kicker">🏆 MENTAL ARİTMETİK ŞAMPİYONU</p><h2>Sonuçlar</h2><Leaderboard players={state.players} me="" /><button className="duel-primary" onClick={onLeave}>ANA MENÜ</button></div>; }
