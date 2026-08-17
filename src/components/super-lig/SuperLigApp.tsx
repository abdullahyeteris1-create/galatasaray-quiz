"use client";
/* eslint-disable react-hooks/purity, react-hooks/exhaustive-deps */

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ActionButton, ErrorNotice, SoundControl } from "../quiz/primitives";
import { getAudioManager } from "@/lib/audio/audioManager";
import { isInvalidSessionError, mapQuizError } from "@/lib/quiz/errors";
import { toTimestamp } from "@/lib/quiz/time";
import { answerSuperLig, createSuperLigRoom, getSuperLigState, joinSuperLigRoom, startSuperLigGame, tickSuperLig } from "@/lib/super-lig/api";
import { clearSuperLigSession, credentialsToSuperLigSession, loadSuperLigSession, saveSuperLigSession } from "@/lib/super-lig/storage";
import type { SuperLigEra, SuperLigSession, SuperLigState } from "@/lib/super-lig/types";

const audio = getAudioManager();
const labels = ["A", "B", "C", "D"];

export function SuperLigApp() {
  const router = useRouter();
  const [screen, setScreen] = useState<"home" | "create" | "join" | "session">("home");
  const [session, setSession] = useState<SuperLigSession | null>(null);
  const [state, setState] = useState<SuperLigState | null>(null);
  const [offset, setOffset] = useState(0);
  const [booting, setBooting] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [era, setEra] = useState<SuperLigEra>("mixed");
  const [questionCount, setQuestionCount] = useState(10);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const locks = useRef(new Set<string>());

  const reset = (next: "home" | "create" = "home") => { clearSuperLigSession(); setSession(null); setState(null); setSelected({}); locks.current.clear(); setError(null); setScreen(next); };

  useEffect(() => {
    const stored = loadSuperLigSession();
    if (!stored) { queueMicrotask(() => setBooting(false)); return; }
    getSuperLigState(stored.roomId, stored.playerId, stored.token).then((synced) => { setSession(stored); setState(synced.state); setOffset(synced.serverOffsetMs); setScreen("session"); }).catch((e) => { if (isInvalidSessionError(e)) clearSuperLigSession(); }).finally(() => queueMicrotask(() => setBooting(false)));
  }, []);

  useEffect(() => { if (!session || booting) return; let stop = false; let timer: number | undefined; const poll = async () => { try { const s = await getSuperLigState(session.roomId, session.playerId, session.token); if (!stop) { setState(s.state); setOffset(s.serverOffsetMs); setError(null); if (s.state.room.status !== "finished") timer = window.setTimeout(poll, s.state.room.status === "waiting" ? 1000 : 500); } } catch (e) { if (!stop) { setError(isInvalidSessionError(e) ? "Oturum sona erdi." : "Bağlantı zayıf, yeniden deneniyor…"); timer = window.setTimeout(poll, 1500); } } }; void poll(); return () => { stop = true; if (timer) window.clearTimeout(timer); }; }, [session, booting]);
  useEffect(() => { if (!session || !state || state.room.status !== "playing" || state.room.host_player_id !== session.playerId) return; let stop = false; const tick = async () => { try { await tickSuperLig(session.roomId, session.playerId, session.token); } finally { if (!stop) window.setTimeout(tick, 700); } }; void tick(); return () => { stop = true; }; }, [session, state?.room.status, state?.room.host_player_id]);
  useEffect(() => { audio.setLobbyActive(screen !== "session" || state?.room.status === "waiting"); }, [screen, state?.room.status]);

  async function open(credentials: SuperLigSession) { saveSuperLigSession(credentials); setSession(credentials); setScreen("session"); try { const s = await getSuperLigState(credentials.roomId, credentials.playerId, credentials.token); setState(s.state); setOffset(s.serverOffsetMs); } catch (e) { setError(mapQuizError(e)); } }
  async function create() { if (!name.trim()) return; audio.activate(); setPending(true); setError(null); try { await open(credentialsToSuperLigSession(await createSuperLigRoom(name.trim(), era, questionCount))); } catch (e) { setError(mapQuizError(e, "Oda oluşturulamadı.")); } finally { setPending(false); } }
  async function join() { if (!name.trim() || code.trim().length !== 6) return; audio.activate(); setPending(true); setError(null); try { await open(credentialsToSuperLigSession(await joinSuperLigRoom(code.trim(), name.trim()))); } catch (e) { setError(mapQuizError(e, "Odaya katılınamadı.")); } finally { setPending(false); } }
  async function start() { if (!session) return; audio.activate(); try { await startSuperLigGame(session.roomId, session.playerId, session.token); } catch (e) { setError(mapQuizError(e, "Oyun başlatılamadı.")); } }
  async function answer(option: number) { const round = state?.round; if (!session || !round || round.answered || locks.current.has(round.id)) return; locks.current.add(round.id); try { await answerSuperLig(session.roomId, round.id, session.playerId, session.token, option); setSelected((v) => ({ ...v, [round.id]: option })); } catch (e) { locks.current.delete(round.id); setError(mapQuizError(e)); } }

  if (booting) return <main className="super-lig-shell"><div className="super-lig-phone"><p>Super Lig arenası hazırlanıyor…</p></div></main>;
  if (screen === "home") return <Shell><div className="super-lig-home"><p className="super-lig-kicker">TÜRKİYE’NİN FUTBOL ARENASI</p><h1>Super Lig<br /><span>Düello</span></h1><p>İki oyuncu, tek saha. Futbol bilgisini ve hızını kanıtla.</p><ActionButton className="super-lig-primary" onClick={() => { audio.activate(); setScreen("create"); }}>Oda Oluştur</ActionButton><ActionButton tone="ghost" className="super-lig-secondary" onClick={() => { audio.activate(); setScreen("join"); }}>Odaya Katıl</ActionButton><button className="super-lig-menu" onClick={() => router.push("/")}>← Oyun seçimine dön</button></div></Shell>;
  if (screen === "create" || screen === "join") return <Shell><div className="super-lig-form"><button className="super-lig-back" onClick={() => setScreen("home")}>← Geri</button><p className="super-lig-kicker">{screen === "create" ? "YENİ DÜELLO" : "ARENA'YA KATIL"}</p><h1>{screen === "create" ? "Oda Oluştur" : "Odaya Katıl"}</h1><ErrorNotice message={error} /><label>Oyuncu adı<input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} /></label>{screen === "join" && <label>Oda kodu<input value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} /></label>}{screen === "create" && <><fieldset><legend>Dönem</legend>{(["mixed", "2000s", "2010s", "2020s"] as SuperLigEra[]).map((v) => <button key={v} type="button" className={era === v ? "chosen" : ""} onClick={() => setEra(v)}>{v === "mixed" ? "Karışık" : v}</button>)}</fieldset><fieldset><legend>Soru sayısı</legend>{[10, 15, 20].map((v) => <button key={v} type="button" className={questionCount === v ? "chosen" : ""} onClick={() => setQuestionCount(v)}>{v}</button>)}</fieldset></>}<ActionButton disabled={pending || !name.trim() || (screen === "join" && code.length !== 6)} onClick={screen === "create" ? create : join}>{pending ? "Hazırlanıyor…" : screen === "create" ? "Düelloyu Başlat" : "Katıl"}</ActionButton></div></Shell>;
  if (!session || !state) return <Shell><p>Odaya bağlanılıyor…</p></Shell>;
  if (state.room.status === "waiting") return <Shell><div className="super-lig-lobby"><p className="super-lig-kicker">ODA {state.room.code}</p><h1>Rakibin bekleniyor</h1><p>{state.players.length}/2 oyuncu hazır</p>{state.players.map((p) => <div className="super-lig-player" key={p.id}>{p.name}{p.is_host ? " · HOST" : ""}</div>)}<ErrorNotice message={error} />{state.room.host_player_id === session.playerId && <ActionButton disabled={state.players.length < 2} onClick={start}>Düelloyu başlat</ActionButton>}</div></Shell>;
  if (state.room.status === "finished") { const winner = [...state.players].sort((a, b) => b.score - a.score)[0]; return <Shell><div className="super-lig-final"><p className="super-lig-kicker">MAÇ BİTTİ</p><h1>{winner?.name ?? "Kazanan"}</h1><p>{winner?.score ?? 0} puan ile düelloyu kazandı.</p><ActionButton onClick={() => reset("create")}>Tekrar Oyna</ActionButton><ActionButton tone="ghost" onClick={() => reset("create")}>Yeni Oda</ActionButton><button className="super-lig-menu" onClick={() => router.push("/")}>Oyun seçimine dön</button></div></Shell>; }
  return <Game state={state} offset={offset} selected={state.round ? selected[state.round.id] ?? null : null} onAnswer={answer} />;
}

function Shell({ children }: { children: ReactNode }) { return <main className="super-lig-shell"><div className="super-lig-phone"><SoundControl />{children}</div></main>; }
function Game({ state, offset, selected, onAnswer }: { state: SuperLigState; offset: number; selected: number | null; onAnswer: (n: number) => Promise<void> }) { const [, rerender] = useState(0); useEffect(() => { const i = window.setInterval(() => rerender((n) => n + 1), 200); return () => window.clearInterval(i); }, []); const round = state.round; if (!round) return <Shell><p>İlk tur hazırlanıyor…</p></Shell>; const now = Date.now() + offset; const left = Math.max(0, Math.ceil((toTimestamp(round.ends_at) - now) / 1000)); if (state.reveal) return <Shell><div className="super-lig-reveal"><p className="super-lig-kicker">TUR {round.number} SONUCU</p><h1>{state.reveal.winner_id ? "Tur tamamlandı" : "Berabere"}</h1><p>Doğru cevap: <strong>{labels[state.reveal.correct_option]}</strong></p><p>{state.reveal.explanation}</p>{state.reveal.answers.map((a) => <div className="super-lig-answer-result" key={a.player_id}>{a.is_correct ? "✓" : "–"} {a.response_ms ? `${(a.response_ms / 1000).toFixed(2)} sn` : "Cevap yok"}</div>)}</div></Shell>; return <Shell><div className="super-lig-game"><header><span>TUR {round.number} / {state.room.question_count}</span><strong className={left <= 5 ? "urgent" : ""}>{left}s</strong></header><div className="super-lig-progress"><i style={{ width: `${(left / 15) * 100}%` }} /></div><p className="super-lig-category">{round.category} · {round.difficulty}</p><h1>{round.question}</h1><div className="super-lig-answer-grid">{round.options.map((option, i) => <button key={option} className={selected === i ? "chosen" : ""} disabled={round.answered || left === 0} onClick={() => onAnswer(i)}><b>{labels[i]}</b>{option}</button>)}</div>{selected !== null && <p className="super-lig-status">Cevabın alındı. Rakibin bekleniyor.</p>}</div></Shell>; }
