"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GALATASARAY_MEMORY_DATA, MEMORY_CATEGORIES, type MemoryCategory } from "@/lib/memory/galatasarayMemoryData";
import { ClassicMemoryGame } from "./ClassicMemoryGame";

type Level = "beginner" | "advanced" | "master" | "legend";
type Card = { id: string; pairId: string; value: string; side: "left" | "right" };
type CategoryChoice = MemoryCategory | "mixed";

const LEVELS: Record<Level, { label: string; pairs: number; note: string }> = {
  beginner: { label: "Başlangıç", pairs: 3, note: "3 çift · 6 kart" },
  advanced: { label: "İleri", pairs: 4, note: "4 çift · 8 kart" },
  master: { label: "Usta", pairs: 6, note: "6 çift · 12 kart" },
  legend: { label: "Efsane", pairs: 8, note: "8 çift · 16 kart" },
};

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function MemoryRaceGame() {
  const [mode, setMode] = useState<"menu" | "info" | "classic">("menu");
  const [level, setLevel] = useState<Level>("beginner");
  const [category, setCategory] = useState<CategoryChoice>("mixed");
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!started || finished) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [started, finished]);

  const score = useMemo(() => Math.max(0, matched.length * 100 + Math.max(0, 600 - seconds * 5) - wrong * 25), [matched.length, seconds, wrong]);

  const startGame = useCallback(() => {
    const pool = category === "mixed" ? GALATASARAY_MEMORY_DATA : GALATASARAY_MEMORY_DATA.filter((item) => item.category === category);
    const selected = shuffle(pool).slice(0, LEVELS[level].pairs);
    setCards(shuffle(selected.flatMap((pair) => [
      { id: `${pair.id}-left`, pairId: pair.id, value: pair.left, side: "left" as const },
      { id: `${pair.id}-right`, pairId: pair.id, value: pair.right, side: "right" as const },
    ])));
    setFlipped([]); setMatched([]); setMoves(0); setWrong(0); setSeconds(0); setBusy(false); setFinished(false); setStarted(true);
  }, [category, level]);

  function selectCard(card: Card) {
    if (busy || matched.includes(card.pairId) || flipped.includes(card.id) || flipped.length === 2) return;
    const next = [...flipped, card.id];
    setFlipped(next);
    if (next.length !== 2) return;
    setBusy(true);
    setMoves((value) => value + 1);
    const first = cards.find((item) => item.id === next[0]);
    const isMatch = first?.pairId === card.pairId && first.side !== card.side;
    window.setTimeout(() => {
      if (isMatch) {
        const nextMatched = [...matched, card.pairId];
        setMatched(nextMatched);
        if (nextMatched.length === LEVELS[level].pairs) setFinished(true);
      } else {
        setWrong((value) => value + 1);
      }
      setFlipped([]); setBusy(false);
    }, isMatch ? 260 : 720);
  }

  if (mode === "classic") return <main className="memory-page"><ClassicMemoryGame onBack={() => setMode("menu")} /></main>;
  if (mode === "menu") return <MemoryModeMenu onInfo={() => setMode("info")} onClassic={() => setMode("classic")} />;
  if (!started) return <MemoryMenu level={level} category={category} onLevel={setLevel} onCategory={setCategory} onStart={startGame} onBack={() => setMode("menu")} />;

  return (
    <main className="memory-page">
      <section className="memory-shell" aria-label="Galatasaray Hafıza Yarışı">
        <div className="memory-topbar"><Link href="/">← Ana Menü</Link><span>{LEVELS[level].label} · {MEMORY_CATEGORIES.find((item) => item.id === category)?.label}</span></div>
        <header className="memory-game-heading"><div><p>GALATASARAY</p><h1>HAFIZA YARIŞI</h1></div><Image src="/galatasaray-logo.png" alt="Galatasaray logosu" width={54} height={54} /></header>
        <div className="memory-stats" aria-label="Oyun istatistikleri"><span><b>{formatTime(seconds)}</b><small>Süre</small></span><span><b>{moves}</b><small>Hamle</small></span><span><b>{matched.length}/{LEVELS[level].pairs}</b><small>Doğru</small></span><span><b>{wrong}</b><small>Yanlış</small></span></div>
        <div className={`memory-card-grid memory-cards-${cards.length}`}>
          {cards.map((card) => { const open = flipped.includes(card.id) || matched.includes(card.pairId); return <button key={card.id} className={`memory-card ${open ? "is-open" : ""} ${matched.includes(card.pairId) ? "is-matched" : ""}`} onClick={() => selectCard(card)} aria-label={open ? card.value : "Kapalı kart"} disabled={matched.includes(card.pairId)}><span className="memory-card-inner"><span className="memory-card-front">GS</span><span className="memory-card-back">{card.value}</span></span></button>; })}
        </div>
        {finished && <MemoryResult seconds={seconds} moves={moves} matched={matched.length} wrong={wrong} score={score} onReplay={startGame} />}
      </section>
    </main>
  );
}

function MemoryModeMenu({ onInfo, onClassic }: { onInfo: () => void; onClassic: () => void }) {
  return <main className="memory-page"><section className="memory-shell memory-menu"><Link className="memory-back-link" href="/">← Ana Menü</Link><Image className="memory-logo" src="/galatasaray-logo.png" alt="Galatasaray logosu" width={112} height={112} priority /><p className="memory-kicker">GALATASARAY</p><h1>HAFIZA YARIŞI</h1><p className="memory-intro">Kartları hatırla, eşleştir ve sarı-kırmızı hafızanı göster.</p><div className="memory-mode-menu"><button onClick={onInfo}><strong>BİLGİ EŞLEŞTİRME</strong><span>Oyuncu–sezon, kulüp, mevki ve Avrupa tarihi</span></button><button onClick={onClassic}><strong>KLASİK KART EŞLEŞTİRME</strong><span>Aynı futbolcunun kartlarını bul · Tek veya çok oyunculu</span></button></div></section></main>;
}

function MemoryMenu({ level, category, onLevel, onCategory, onStart, onBack }: { level: Level; category: CategoryChoice; onLevel: (value: Level) => void; onCategory: (value: CategoryChoice) => void; onStart: () => void; onBack: () => void }) {
  return <main className="memory-page"><section className="memory-shell memory-menu"><button className="memory-back-link memory-plain-button" onClick={onBack}>← Modlar</button><Image className="memory-logo" src="/galatasaray-logo.png" alt="Galatasaray logosu" width={112} height={112} priority /><p className="memory-kicker">BİLGİ EŞLEŞTİRME</p><h1>HAFIZA YARIŞI</h1><p className="memory-intro">Kartları hatırla, eşleştir ve sarı-kırmızı hafızanı göster.</p><h2>Seviye seç</h2><div className="memory-choice-grid">{(Object.entries(LEVELS) as [Level, typeof LEVELS[Level]][]).map(([id, item]) => <button key={id} className={level === id ? "selected" : ""} onClick={() => onLevel(id)}><strong>{item.label}</strong><span>{item.note}</span></button>)}</div><h2>Kategori seç</h2><div className="memory-category-grid">{MEMORY_CATEGORIES.map((item) => <button key={item.id} className={category === item.id ? "selected" : ""} onClick={() => onCategory(item.id)}>{item.label}</button>)}</div><button className="memory-primary-button" onClick={onStart}>OYUNA BAŞLA <span aria-hidden="true">→</span></button></section></main>;
}

function MemoryResult({ seconds, moves, matched, wrong, score, onReplay }: { seconds: number; moves: number; matched: number; wrong: number; score: number; onReplay: () => void }) {
  return <div className="memory-result" role="dialog" aria-label="Oyun sonucu"><div className="memory-trophy">🏆</div><p>HAFIZA TAMAMLANDI</p><h2>Harika iş, Aslan!</h2><div className="memory-result-grid"><span><b>{formatTime(seconds)}</b><small>Süre</small></span><span><b>{moves}</b><small>Hamle</small></span><span><b>{matched}</b><small>Doğru eşleşme</small></span><span><b>{wrong}</b><small>Yanlış deneme</small></span><span className="memory-result-score"><b>{score}</b><small>Skor</small></span></div><div className="memory-result-actions"><button className="memory-primary-button" onClick={onReplay}>TEKRAR OYNA</button><Link className="memory-secondary-button" href="/">ANA MENÜ</Link></div></div>;
}
