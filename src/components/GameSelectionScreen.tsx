"use client";

import Link from "next/link";

import { getAudioManager } from "@/lib/audio/audioManager";

import { useEffect } from "react";

export function GameSelectionScreen() {
  useEffect(() => {
    const audioManager = getAudioManager();
    audioManager.setLobbyActive(true);
    return () => audioManager.setLobbyActive(false);
  }, []);

  function activateAudio() {
    getAudioManager().activate();
  }

  return (
    <main className="game-selection-shell">
      <div className="selection-orb selection-orb-yellow" aria-hidden="true" />
      <div className="selection-orb selection-orb-green" aria-hidden="true" />
      <section className="game-selection">
        <header className="selection-header">
          <p className="selection-eyebrow">GALATASARAY QUIZ PLATFORM</p>
          <h1>Oyununu Seç</h1>
          <p>Arkadaşlarınla yarış, futbol tarihindeki yerini göster.</p>
        </header>

        <div className="game-selection-grid">
          <Link className="game-card game-card-galatasaray" href="/galatasaray" onClick={activateAudio}>
            <div className="game-card-glow" aria-hidden="true" />
            <span className="game-card-badge">SARI · KIRMIZI</span>
            <span className="game-card-mark" aria-hidden="true">GS</span>
            <div className="game-card-content">
              <h2>Galatasaray Quiz</h2>
              <p>Galatasaray tarihini ne kadar iyi biliyorsun?</p>
              <span className="game-card-cta">Galatasaray Quiz Oyna <b aria-hidden="true">→</b></span>
            </div>
          </Link>

          <Link className="game-card game-card-super-lig" href="/super-lig" onClick={activateAudio}>
            <div className="game-card-pitch" aria-hidden="true"><i /><i /><i /></div>
            <span className="game-card-badge">GECE STADYUMU</span>
            <span className="game-card-mark game-card-mark-ball" aria-hidden="true">◉</span>
            <div className="game-card-content">
              <h2>Süper Lig Düellosu</h2>
              <p>Süper Lig bilgin ve hızınla arkadaşına meydan oku.</p>
              <span className="game-card-cta">Süper Lig Düellosu Oyna <b aria-hidden="true">→</b></span>
            </div>
          </Link>

          <Link className="game-card game-card-memory" href="/hafiza-yarisi">
            <div className="game-card-memory-pattern" aria-hidden="true" />
            <span className="game-card-badge">TEK OYUNCU · HAFIZA</span>
            <span className="game-card-mark" aria-hidden="true">🧠</span>
            <div className="game-card-content">
              <h2>Hafıza Yarışı</h2>
              <p>Galatasaray oyuncularını, sezonlarını ve tarihi eşleştir.</p>
              <span className="game-card-cta">Hafıza Yarışı Oyna <b aria-hidden="true">→</b></span>
            </div>
          </Link>
        </div>

        <p className="selection-footnote">İki oyun · Tek futbol tutkusu</p>
      </section>
    </main>
  );
}
