"use client";

import { useMultiplayerQuiz } from "@/components/multiplayer-quiz/useMultiplayerQuiz";
import {
  answerQuestion,
  createRoom,
  getQuizState,
  hostTick,
  joinRoom,
  startGame,
} from "@/lib/quiz/api";
import {
  clearSession,
  credentialsToSession,
  loadSession,
  saveSession,
} from "@/lib/quiz/storage";
import type { QuizSession, QuizState } from "@/lib/quiz/types";

import { CreateRoomScreen } from "./CreateRoomScreen";
import { FinalScreen } from "./FinalScreen";
import { GameScreen } from "./GameScreen";
import { HomeScreen } from "./HomeScreen";
import { JoinRoomScreen } from "./JoinRoomScreen";
import { LobbyScreen } from "./LobbyScreen";
import { LoadingScreen } from "./primitives";

const quizLifecycleConfig = {
  sessionStore: {
    clear: clearSession,
    load: loadSession,
    save: saveSession,
  },
  getState: getQuizState,
  hostTick,
  startGame,
  answerQuestion,
  revealStoragePrefix: "gs_quiz_reveal_played",
};

export function QuizApp() {
  const flow = useMultiplayerQuiz<QuizState, QuizSession>(quizLifecycleConfig);

  async function handleCreate(name: string, maxPlayers: number, questionCount: number) {
    await flow.enterSession(
      async () => credentialsToSession(await createRoom(name, maxPlayers, questionCount)),
      "Oda oluşturulamadı. Lütfen tekrar dene.",
    );
  }

  async function handleJoin(code: string, name: string) {
    await flow.enterSession(
      async () => credentialsToSession(await joinRoom(code, name)),
      "Odaya katılınamadı. Lütfen bilgileri kontrol et.",
    );
  }

  if (flow.booting) return <LoadingScreen label="Oturum kontrol ediliyor…" />;

  if (flow.screen === "home") {
    return (
      <HomeScreen
        onCreate={() => flow.navigateTo("create")}
        onJoin={() => flow.navigateTo("join")}
      />
    );
  }

  if (flow.screen === "create") {
    return (
      <CreateRoomScreen
        error={flow.actionError}
        pending={flow.pending}
        onBack={() => flow.navigateTo("home")}
        onSubmit={handleCreate}
      />
    );
  }

  if (flow.screen === "join") {
    return (
      <JoinRoomScreen
        error={flow.actionError}
        pending={flow.pending}
        onBack={() => flow.navigateTo("home")}
        onSubmit={handleJoin}
      />
    );
  }

  if (!flow.session || !flow.state) {
    return <LoadingScreen label={flow.connectionError ?? "Odaya bağlanılıyor…"} />;
  }

  if (flow.state.room.status === "finished") {
    return (
      <FinalScreen
        players={flow.state.players}
        currentPlayerId={flow.session.playerId}
        onHome={() => flow.resetTo("home")}
        onCreateRoom={() => flow.resetTo("create")}
      />
    );
  }

  if (flow.state.room.status === "waiting") {
    return (
      <LobbyScreen
        room={flow.state.room}
        players={flow.state.players}
        currentPlayerId={flow.session.playerId}
        error={flow.actionError ?? flow.connectionError}
        starting={flow.starting}
        onStart={flow.startGame}
      />
    );
  }

  return (
    <GameScreen
      round={flow.state.round}
      reveal={flow.state.reveal}
      players={flow.state.players}
      currentPlayerId={flow.session.playerId}
      totalQuestions={flow.state.room.question_count}
      serverOffsetMs={flow.serverOffsetMs}
      selectedOption={flow.selectedOption}
      submitting={flow.submitting}
      error={flow.actionError ?? flow.connectionError}
      onAnswer={flow.answerQuestion}
    />
  );
}
