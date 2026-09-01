"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioManager } from "@/lib/audio/audioManager";
import { getMemoryRaceCardVisual } from "@/lib/memory-race/cardVisuals";
import { createBoard, MEMORY_RACE_LEVELS, MEMORY_RACE_MAX_PLAYERS, type MemoryRaceLevel, type MemoryRaceSession } from "@/lib/memory-race-online/config";
import { createRoom, flipCard, getState, hostStart, joinRoom, MemoryRaceRpcError, tick, type MemoryRacePlayer, type MemoryRaceState } from "@/lib/memory-race-online/api";

const SESSION_KEY = "gs_memory_race_session";
type Screen = "home" | "setup" | "join" | "lobby" | "game" | "final";

function parseSession(raw: string | null): MemoryRaceSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<MemoryRaceSession>;
    if (typeof value.roomId !== "string" || typeof value.playerId !== "string" || typeof value.token !== "string" || typeof value.code !== "string") return null;
    return { roomId: value.roomId, playerId: value.playerId, token: value.token, code: value.code };
  } catch {
    return null;
  }
}

function isTerminalSessionError(error: unknown) {
  return error instanceof MemoryRaceRpcError && (error.code === "UNAUTHORIZED_PLAYER" || error.code === "ROOM_NOT_FOUND");
}

function formatTime(value: number) { return `${Math.max(0, Math.floor(value / 60)).toString().padStart(2, "0")}:${(Math.max(0, value) % 60).toString().padStart(2, "0")}`; }
function sortPlayers(players: MemoryRacePlayer[]) { return [...players].sort((a, b) => b.score - a.score || b.correct - a.correct || a.wrong - b.wrong); }

export function MemoryRaceOnline() {
  const [screen, setScreen] = useState<Screen>("home");
  const [session, setSession] = useState<MemoryRaceSession | null>(null);
  const [state, setState] = useState<MemoryRaceState | null>(null);
  const [name, setName] = useState(""); const [code, setCode] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4); const [level, setLevel] = useState<MemoryRaceLevel>(1);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [offset, setOffset] = useState(0); const [clientNow, setClientNow] = useState(0);
  const [soloBoard, setSoloBoard] = useState<ReturnType<typeof createBoard>>([]); const [soloOpen, setSoloOpen] = useState<number[]>([]); const [soloMatched, setSoloMatched] = useState<number[]>([]); const [soloScore, setSoloScore] = useState(0);
  const pollingInFlightRef = useRef(false);
  const tickInFlightRef = useRef(false);
  const currentStateRef = useRef<MemoryRaceState | null>(null);
  const pollingGenerationRef = useRef(0);
  const pendingFlipRef = useRef(false);

  const applyState = useCallback((nextState: MemoryRaceState, serverOffsetMs: number) => {
    const previousState = currentStateRef.current;
    if (pendingFlipRef.current && previousState) {
      const previousMatched = previousState.cards.filter((card) => card.matched).length;
      const nextMatched = nextState.cards.filter((card) => card.matched).length;
      if (nextMatched > previousMatched) {
        getAudioManager().playRevealEffect(true);
        pendingFlipRef.current = false;
      } else if (nextState.room.reveal_until && !previousState.room.reveal_until) {
        getAudioManager().playRevealEffect(false);
        pendingFlipRef.current = false;
      }
    }
    currentStateRef.current = nextState;
    setState(nextState);
    setOffset(serverOffsetMs);
    setError("");
    setScreen(nextState.room.status === "finished" ? "final" : nextState.room.status === "waiting" ? "lobby" : "game");
  }, []);

  const pollState = useCallback(async (activeSession: MemoryRaceSession) => {
    const result = await getState(activeSession);
    applyState(result.state, result.serverOffsetMs);
    return result.state.room.status;
  }, [applyState]);

  const serverNow = clientNow + offset;
  const remaining = state?.room.ends_at && clientNow ? Math.ceil((Date.parse(state.room.ends_at) - serverNow) / 1000) : 0;
  const me = state?.players.find((player) => player.id === session?.playerId);
  const isHost = !!me?.is_host;
  const sessionCode = session?.code ?? "";

  useEffect(() => {
    const restored = parseSession(window.localStorage.getItem(SESSION_KEY));
    if (restored) setSession(restored);
    else window.localStorage.removeItem(SESSION_KEY);
  }, []);

  useEffect(() => {
    const roomId = session?.roomId;
    const playerId = session?.playerId;
    const token = session?.token;
    const code = sessionCode;
    if (!roomId || !playerId || !token) return;

    const activeSession: MemoryRaceSession = { roomId, playerId, token, code };
    const generation = ++pollingGenerationRef.current;
    let cancelled = false;
    let timer: number | null = null;

    const schedule = (delay: number) => {
      if (!cancelled && pollingGenerationRef.current === generation) timer = window.setTimeout(() => void poll(), delay);
    };

    const poll = async () => {
      if (cancelled || pollingGenerationRef.current !== generation) return;
      if (pollingInFlightRef.current) {
        schedule(100);
        return;
      }

      pollingInFlightRef.current = true;
      if (process.env.NODE_ENV !== "production") console.debug("[memory-race] get_state start");
      try {
        const status = await pollState(activeSession);
        if (process.env.NODE_ENV !== "production") console.debug("[memory-race] get_state end", status);
        if (status !== "finished") schedule(status === "waiting" ? 1200 : 800);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.error("[memory-race] get_state failed", error);
        if (isTerminalSessionError(error)) {
          window.localStorage.removeItem(SESSION_KEY);
          setSession(null);
          setState(null);
          currentStateRef.current = null;
          setScreen("home");
          setError("Oda oturumunuz artık geçerli değil.");
        } else {
          setError("Bağlantı geçici olarak kesildi. Yeniden deneniyor…");
          schedule(2000);
        }
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [session?.roomId, session?.playerId, session?.token, sessionCode, pollState]);

  useEffect(() => {
    const roomId = session?.roomId;
    const playerId = session?.playerId;
    const token = session?.token;
    const code = sessionCode;
    const status = state?.room.status;
    if (!roomId || !playerId || !token || status !== "playing") return;

    const activeSession: MemoryRaceSession = { roomId, playerId, token, code };

    let cancelled = false;
    let timer: number | null = null;
    const runTick = async () => {
      if (cancelled) return;
      if (tickInFlightRef.current) {
        timer = window.setTimeout(() => void runTick(), 100);
        return;
      }
      tickInFlightRef.current = true;
      try {
        await tick(activeSession);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.error("[memory-race] tick failed", error);
      } finally {
        tickInFlightRef.current = false;
        if (!cancelled) timer = window.setTimeout(() => void runTick(), 1000);
      }
    };

    void runTick();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [session?.roomId, session?.playerId, session?.token, sessionCode, state?.room.status]);
  async function enter(request: Promise<{ room_id: string; player_id: string; token: string; code: string }>) { setBusy(true); setError(""); try { const result = await request; const next = { roomId: result.room_id, playerId: result.player_id, token: result.token, code: result.code }; window.localStorage.setItem(SESSION_KEY, JSON.stringify(next)); setSession(next); setScreen("lobby"); } catch (e) { setError(e instanceof Error ? e.message : "Odaya bağlanılamadı."); } finally { setBusy(false); } }
  async function startHost() { if (!session) return; setBusy(true); setError(""); try { await hostStart(session); } catch (e) { setError(e instanceof Error ? e.message : "Oyun başlatılamadı."); } finally { setBusy(false); } }
  function startSolo() { setSoloBoard(createBoard(level)); setSoloOpen([]); setSoloMatched([]); setSoloScore(0); setScreen("game"); }
  function leave() { window.localStorage.removeItem(SESSION_KEY); setSession(null); setState(null); setScreen("home"); }
  useEffect(() => { const timer = window.setInterval(() => setClientNow(Date.now()), 250); setClientNow(Date.now()); return () => window.clearInterval(timer); }, []);
  if (screen === "home") return <PageShell><div className="race-hero"><Link href="/" className="race-back">← Ana Menü</Link><div className="race-logo">GS</div><p className="race-kicker">GALATASARAY · CANLI OYUN</p><h1>HAFIZA<br /><span>YARIŞI ONLINE</span></h1><p>Aynı hafıza parkurunda arkadaşlarınla canlı yarış.</p><div className="race-actions"><button onClick={() => setScreen("setup")}>TEK OYUNCU</button><button onClick={() => setScreen("setup")}>ODA OLUŞTUR</button><button className="race-secondary" onClick={() => setScreen("join")}>ODAYA KATIL</button></div></div></PageShell>;
  if (screen === "setup" && !session) return <PageShell><Setup title="Oyuncu ve seviye seç" name={name} setName={setName} level={level} setLevel={setLevel} maxPlayers={maxPlayers} setMaxPlayers={setMaxPlayers} onBack={() => setScreen("home")} onCreate={() => void enter(createRoom(name, maxPlayers, level, 3))} onSolo={startSolo} busy={busy} error={error} /></PageShell>;
  if (screen === "join" && !session) return <PageShell><div className="race-panel"><button className="race-back" onClick={() => setScreen("home")}>← Geri</button><p className="race-kicker">ODA KODU</p><h2>Yarışa katıl</h2><input className="race-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Oyuncu adın" maxLength={24} /><input className="race-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="6 karakterli oda kodu" maxLength={6} /><button className="race-primary" disabled={!name.trim() || code.length !== 6 || busy} onClick={() => void enter(joinRoom(code, name))}>ODAYA KATIL</button>{error && <p className="race-error">{error}</p>}</div></PageShell>;
  if (screen === "lobby" && state && session) return <PageShell><div className="race-panel"><p className="race-kicker">BEKLEME ODASI</p><h2>Oda {state.room.code}</h2><p className="race-muted">Oyuncular · {state.players.length}/{state.room.max_players}</p><div className="race-players">{state.players.map((player) => <div key={player.id} className={player.id === session.playerId ? "race-player mine" : "race-player"}>👤 {player.name}{player.is_host && <small> HOST</small>}</div>)}</div>{isHost ? <button className="race-primary" disabled={state.players.length < 2 || busy} onClick={() => void startHost()}>OYUNU BAŞLAT</button> : <p className="race-muted">Oda sahibinin oyunu başlatması bekleniyor…</p>}<button className="race-link" onClick={leave}>Odadan çık</button>{error && <p className="race-error">{error}</p>}</div></PageShell>;
  if (screen === "game" && state && session) return <PageShell board><OnlineBoard state={state} session={session} serverNow={serverNow} remaining={remaining} onCard={async (index) => { setBusy(true); pendingFlipRef.current = true; try { await flipCard(session, index); } catch (e) { pendingFlipRef.current = false; setError(e instanceof Error ? e.message : "Kart açılamadı."); } finally { setBusy(false); } }} busy={busy} error={error} onLeave={leave} /></PageShell>;
  if (screen === "game" && soloBoard.length) return <SoloBoard board={soloBoard} open={soloOpen} matched={soloMatched} score={soloScore} onCard={(index) => { if (soloOpen.length >= 2 || soloMatched.includes(index) || soloOpen.includes(index)) return; const next = [...soloOpen, index]; setSoloOpen(next); if (next.length === 2) { const match = soloBoard[next[0]].pair === soloBoard[index].pair; window.setTimeout(() => { if (match) { setSoloMatched((v) => [...v, ...next]); setSoloScore((v) => v + 100); } setSoloOpen([]); }, match ? 260 : 720); } }} onBack={() => setScreen("home")} />;
  if (screen === "final" && state && session) return <PageShell><div className="race-panel"><p className="race-kicker">🏆 HAFIZA YARIŞI ŞAMPİYONU</p><h2>{sortPlayers(state.players)[0]?.name}</h2><Leaderboard players={state.players} me={session.playerId} final /><button className="race-primary" onClick={leave}>ANA MENÜ</button></div></PageShell>;
  return <PageShell><div className="race-panel"><p className="race-error">Oyun oturumu hazırlanıyor…</p></div></PageShell>;
}

function PageShell({ children, board = false }: { children: React.ReactNode; board?: boolean }) { return <main className="memory-page race-page"><section className={board ? "memory-shell race-shell race-shell-board" : "memory-shell race-shell"}>{children}</section></main>; }
type SetupProps = { title: string; name: string; setName: (value: string) => void; level: MemoryRaceLevel; setLevel: (value: MemoryRaceLevel) => void; maxPlayers: number; setMaxPlayers: (value: number) => void; onBack: () => void; onCreate: () => void; onSolo: () => void; busy: boolean; error: string };
function Setup({ title, name, setName, level, setLevel, maxPlayers, setMaxPlayers, onBack, onCreate, onSolo, busy, error }: SetupProps) { return <div className="race-panel"><button className="race-back" onClick={onBack}>← Geri</button><p className="race-kicker">HAFIZA YARIŞI ONLINE</p><h2>{title}</h2><input className="race-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Oyuncu adın" maxLength={24} /><h3>Seviye</h3><div className="race-options">{Object.entries(MEMORY_RACE_LEVELS).map(([key, item]) => <button key={key} className={level === Number(key) ? "chosen" : ""} onClick={() => setLevel(Number(key) as MemoryRaceLevel)}>{item.label}<small>{item.cards} kart</small></button>)}</div><h3>Oyuncu sayısı</h3><div className="race-options">{MEMORY_RACE_MAX_PLAYERS.map((value) => <button key={value} className={maxPlayers === value ? "chosen" : ""} onClick={() => setMaxPlayers(value)}>{value}</button>)}</div><button className="race-primary" disabled={!name.trim() || busy} onClick={onCreate}>ODA OLUŞTUR</button><button className="race-secondary" disabled={!name.trim()} onClick={onSolo}>TEK OYUNCU BAŞLAT</button>{error && <p className="race-error">{error}</p>}</div>; }
type OnlineBoardProps = { state: MemoryRaceState; session: MemoryRaceSession; serverNow: number; remaining: number; onCard: (index: number) => Promise<void>; busy: boolean; error: string; onLeave: () => void };
function OnlineBoard({ state, session, serverNow, remaining, onCard, busy, error, onLeave }: OnlineBoardProps) {
  const level = MEMORY_RACE_LEVELS[state.room.level];
  const cards = state.cards;
  const currentPlayer = state.players.find((player) => player.id === state.room.current_player_id);
  const isMyTurn = state.room.current_player_id === session.playerId;
  const revealActive = state.room.reveal_until !== null && Date.parse(state.room.reveal_until) > serverNow;
  const canSelect = isMyTurn && !busy && !revealActive && state.room.second_card_index === null;
  return <div className="race-panel race-online-board">
    <div className="race-board-head"><div><p className="race-kicker">ORTAK HAFIZA TAHTASI · TUR {state.room.turn_number}</p><h2>{level.label}</h2></div><strong>{formatTime(remaining)}</strong></div>
    <div className={isMyTurn ? "race-turn active" : "race-turn"}><strong>{isMyTurn ? "SIRA SENDE" : `SIRA: ${currentPlayer?.name ?? "..."}`}</strong><span>{isMyTurn ? "İki kart seç." : `${currentPlayer?.name ?? "Oyuncu"} kart seçiyor, sen de açık kartları görüyorsun."`}</span></div>
    <p className="race-muted">Herkes aynı kart tahtasını görür. Doğru eşleşmede sıra sende kalır.</p>
    <div className={`race-grid race-grid-${cards.length}`}>{cards.map((card) => <button key={card.index} className={`race-card ${card.matched ? "matched" : ""} ${card.value !== null ? "open" : ""}`} disabled={!canSelect || card.matched || card.value !== null} onClick={() => void onCard(card.index)}><span className="race-card-inner"><span className="race-card-front">?</span><span className="race-card-back">{getMemoryRaceCardVisual(state.room.level, card.value)}</span></span></button>)}</div>
    <Leaderboard players={state.players} me={session.playerId} activePlayerId={state.room.current_player_id} /><button className="race-link" onClick={onLeave}>Oyundan çık</button>{error && <p className="race-error">{error}</p>}
  </div>;
}
function Leaderboard({ players, me, activePlayerId, final = false }: { players: MemoryRacePlayer[]; me: string; activePlayerId?: string | null; final?: boolean }) { return <div className={final ? "race-leaderboard final" : "race-leaderboard"}>{sortPlayers(players).map((player, index) => <div key={player.id} className={`${player.id === me ? "mine " : ""}${player.id === activePlayerId ? "active-turn" : ""}`}><b>{index + 1}.</b><span>{player.name}{player.id === me && " · SEN"}{player.id === activePlayerId && " · SIRA"}</span><strong>{player.score}</strong><small>{player.correct} doğru · {player.wrong} yanlış</small></div>)}</div>; }
type SoloBoardProps = { board: ReturnType<typeof createBoard>; open: number[]; matched: number[]; score: number; onCard: (index: number) => void; onBack: () => void };
function SoloBoard({ board, open, matched, score, onCard, onBack }: SoloBoardProps) { return <PageShell><div className="race-panel"><button className="race-back" onClick={onBack}>← Ana Menü</button><div className="race-board-head"><div><p className="race-kicker">TEK OYUNCU</p><h2>HAFIZA YARIŞI</h2></div><strong>{score}</strong></div><div className={`race-grid race-grid-${board.length}`}>{board.map((card, index) => <button key={card.id} className={`race-card ${open.includes(index) || matched.includes(index) ? "open" : ""} ${matched.includes(index) ? "matched" : ""}`} onClick={() => onCard(index)}><span className="race-card-inner"><span className="race-card-front">?</span><span className="race-card-back">{open.includes(index) || matched.includes(index) ? card.value : "?"}</span></span></button>)}</div></div></PageShell>; }
