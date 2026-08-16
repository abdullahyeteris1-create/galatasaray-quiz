"use client";

import { FormEvent, useState } from "react";

import { ActionButton, ArenaShell, ErrorNotice, ScreenHeader } from "./primitives";

type CreateRoomScreenProps = {
  error: string | null;
  pending: boolean;
  onBack: () => void;
  onSubmit: (name: string, maxPlayers: number, questionCount: number) => Promise<void>;
};

const PLAYER_OPTIONS = [6, 8, 10, 12];
const QUESTION_OPTIONS = [10, 15];

export function CreateRoomScreen({ error, pending, onBack, onSubmit }: CreateRoomScreenProps) {
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [questionCount, setQuestionCount] = useState(10);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    await onSubmit(cleanName, maxPlayers, questionCount);
  }

  return (
    <ArenaShell compact>
      <ScreenHeader eyebrow="YENİ ARENA" title="Oda Oluştur" onBack={onBack} />

      <form className="quiz-form" onSubmit={handleSubmit}>
        <ErrorNotice message={error} />

        <label className="field-label" htmlFor="create-player-name">Oyuncu adı</label>
        <input
          id="create-player-name"
          className="text-input"
          autoComplete="nickname"
          maxLength={24}
          placeholder="Adını yaz"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={pending}
          required
        />

        <fieldset className="choice-group">
          <legend>Maksimum oyuncu</legend>
          <div className="segmented-grid segmented-grid-four">
            {PLAYER_OPTIONS.map((value) => (
              <button
                key={value}
                className={maxPlayers === value ? "selected" : ""}
                type="button"
                aria-pressed={maxPlayers === value}
                onClick={() => setMaxPlayers(value)}
                disabled={pending}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="choice-group">
          <legend>Soru sayısı</legend>
          <div className="segmented-grid segmented-grid-two">
            {QUESTION_OPTIONS.map((value) => (
              <button
                key={value}
                className={questionCount === value ? "selected" : ""}
                type="button"
                aria-pressed={questionCount === value}
                onClick={() => setQuestionCount(value)}
                disabled={pending}
              >
                <strong>{value}</strong><span>soru</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="form-spacer" />
        <ActionButton type="submit" disabled={pending || !name.trim()}>
          {pending ? "Oda kuruluyor…" : "Odayı Oluştur"}
        </ActionButton>
      </form>
    </ArenaShell>
  );
}

