"use client";

import { FormEvent, useState } from "react";

import { ActionButton, ArenaShell, ErrorNotice, ScreenHeader } from "./primitives";

type JoinRoomScreenProps = {
  error: string | null;
  pending: boolean;
  onBack: () => void;
  onSubmit: (code: string, name: string) => Promise<void>;
};

export function JoinRoomScreen({ error, pending, onBack, onSubmit }: JoinRoomScreenProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    if (!cleanCode || !cleanName) return;
    await onSubmit(cleanCode, cleanName);
  }

  return (
    <ArenaShell compact>
      <ScreenHeader eyebrow="MEVCUT ARENA" title="Odaya Katıl" onBack={onBack} />

      <form className="quiz-form" onSubmit={handleSubmit}>
        <ErrorNotice message={error} />

        <label className="field-label" htmlFor="room-code">Oda kodu</label>
        <input
          id="room-code"
          className="text-input code-input"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={8}
          placeholder="A4B91C"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s/g, ""))}
          disabled={pending}
          required
        />

        <label className="field-label" htmlFor="join-player-name">Oyuncu adı</label>
        <input
          id="join-player-name"
          className="text-input"
          autoComplete="nickname"
          maxLength={24}
          placeholder="Adını yaz"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={pending}
          required
        />

        <div className="join-tip">
          <span aria-hidden="true">i</span>
          <p>Oda sahibinin paylaştığı kodu girerek canlı yarışmaya katıl.</p>
        </div>

        <div className="form-spacer" />
        <ActionButton type="submit" disabled={pending || !name.trim() || !code.trim()}>
          {pending ? "Katılınıyor…" : "Katıl"}
        </ActionButton>
      </form>
    </ArenaShell>
  );
}
