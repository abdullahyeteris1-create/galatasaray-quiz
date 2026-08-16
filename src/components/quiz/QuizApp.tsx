"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  answerQuestion,
  createRoom,
  getQuizState,
  hostTick,
  joinRoom,
  startGame,
} from "@/lib/quiz/api";
import { getQuizErrorCode, isInvalidSessionError, mapQuizError } from "@/lib/quiz/errors";
import {
  clearSession,
  credentialsToSession,
  loadSession,
  saveSession,
} from "@/lib/quiz/storage";
import type { QuizSession, QuizState, Screen } from "@/lib/quiz/types";

import { CreateRoomScreen } from "./CreateRoomScreen";
import { FinalScreen } from "./FinalScreen";
import { GameScreen } from "./GameScreen";
import { HomeScreen } from "./HomeScreen";
import { JoinRoomScreen } from "./JoinRoomScreen";
import { LobbyScreen } from "./LobbyScreen";
import { LoadingScreen } from "./primitives";

export function QuizApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [session, setSession] = useState<QuizSession | null>(null);
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [booting, setBooting] = useState(true);
  const [pending, setPending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submittingRound, setSubmittingRound] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [selectedByRound, setSelectedByRound] = useState<Record<string, number>>({});
  const answerLocks = useRef(new Set<string>());
  const latestRoundId = useRef<string | null>(null);

  const roomId = session?.roomId ?? null;
  const playerId = session?.playerId ?? null;
  const token = session?.token ?? null;

  function resetTo(screenName: "home" | "create" = "home") {
    clearSession();
    setSession(null);
    setQuizState(null);
    setSelectedByRound({});
    answerLocks.current.clear();
    setActionError(null);
    setConnectionError(null);
    setScreen(screenName);
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const storedSession = loadSession();
      if (!storedSession) {
        if (!cancelled) setBooting(false);
        return;
      }

      try {
        const synced = await getQuizState(
          storedSession.roomId,
          storedSession.playerId,
          storedSession.token,
        );
        if (cancelled) return;

        setSession(storedSession);
        setQuizState(synced.state);
        setServerOffsetMs(synced.serverOffsetMs);
        setScreen("session");
      } catch (error) {
        if (cancelled) return;

        if (isInvalidSessionError(error)) {
          clearSession();
        } else {
          setSession(storedSession);
          setScreen("session");
          setConnectionError(mapQuizError(error, "Oturum şu anda doğrulanamıyor. Yeniden bağlanılıyor…"));
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!roomId || !playerId || !token || booting) return;
    const activeRoomId = roomId;
    const activePlayerId = playerId;
    const activeToken = token;

    let stopped = false;
    let inFlight = false;
    let timer: number | undefined;

    async function poll() {
      if (stopped || inFlight) return;
      inFlight = true;

      try {
        const synced = await getQuizState(activeRoomId, activePlayerId, activeToken);
        if (stopped) return;

        const nextRoundId = synced.state.round?.id ?? null;
        if (latestRoundId.current !== nextRoundId) {
          latestRoundId.current = nextRoundId;
          setActionError(null);
        }
        setQuizState(synced.state);
        setServerOffsetMs(synced.serverOffsetMs);
        setConnectionError(null);

        if (synced.state.room.status === "finished") return;
        const delay = synced.state.room.status === "waiting" ? 1000 : 650;
        timer = window.setTimeout(poll, delay);
      } catch (error) {
        if (stopped) return;

        if (isInvalidSessionError(error)) {
          clearSession();
          setSession(null);
          setQuizState(null);
          setScreen("home");
          setActionError("Oturumun sona erdi. Lütfen yeniden oda oluştur veya katıl.");
          return;
        }

        setConnectionError("Bağlantı zayıf. Yeniden bağlanılıyor…");
        timer = window.setTimeout(poll, 1500);
      } finally {
        inFlight = false;
      }
    }

    void poll();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [booting, playerId, roomId, token]);

  const isHostPlaying = Boolean(
    playerId &&
    quizState &&
    quizState.room.host_player_id === playerId &&
    quizState.room.status !== "waiting" &&
    quizState.room.status !== "finished",
  );

  useEffect(() => {
    if (!roomId || !playerId || !token || !isHostPlaying) return;
    const activeRoomId = roomId;
    const activePlayerId = playerId;
    const activeToken = token;

    let stopped = false;
    let timer: number | undefined;

    async function tick() {
      try {
        await hostTick(activeRoomId, activePlayerId, activeToken);
      } catch (error) {
        if (!stopped && getQuizErrorCode(error) === "HOST_ONLY") {
          setActionError(mapQuizError(error));
        }
      } finally {
        if (!stopped) timer = window.setTimeout(tick, 1000);
      }
    }

    void tick();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [isHostPlaying, playerId, roomId, token]);

  async function openSession(nextSession: QuizSession) {
    saveSession(nextSession);
    setQuizState(null);
    setScreen("session");

    try {
      const synced = await getQuizState(
        nextSession.roomId,
        nextSession.playerId,
        nextSession.token,
      );
      setQuizState(synced.state);
      latestRoundId.current = synced.state.round?.id ?? null;
      setServerOffsetMs(synced.serverOffsetMs);
      setConnectionError(null);
    } catch (error) {
      setConnectionError(mapQuizError(error, "Odaya bağlanılıyor…"));
    } finally {
      // Polling begins only after this initial request completes, so two
      // quiz_get_state calls can never overlap.
      setSession(nextSession);
    }
  }

  async function handleCreate(name: string, maxPlayers: number, questionCount: number) {
    setPending(true);
    setActionError(null);
    try {
      const credentials = await createRoom(name, maxPlayers, questionCount);
      await openSession(credentialsToSession(credentials));
    } catch (error) {
      setActionError(mapQuizError(error, "Oda oluşturulamadı. Lütfen tekrar dene."));
    } finally {
      setPending(false);
    }
  }

  async function handleJoin(code: string, name: string) {
    setPending(true);
    setActionError(null);
    try {
      const credentials = await joinRoom(code, name);
      await openSession(credentialsToSession(credentials));
    } catch (error) {
      setActionError(mapQuizError(error, "Odaya katılınamadı. Lütfen bilgileri kontrol et."));
    } finally {
      setPending(false);
    }
  }

  async function handleStart() {
    if (!session || starting) return;
    setStarting(true);
    setActionError(null);

    try {
      await startGame(session.roomId, session.playerId, session.token);
    } catch (error) {
      setActionError(mapQuizError(error, "Oyun başlatılamadı. Lütfen tekrar dene."));
    } finally {
      setStarting(false);
    }
  }

  async function handleAnswer(option: number) {
    const round = quizState?.round;
    if (!session || !round || round.answered || answerLocks.current.has(round.id)) return;

    answerLocks.current.add(round.id);
    setSubmittingRound(round.id);
    setActionError(null);

    try {
      await answerQuestion(session.roomId, round.id, session.playerId, session.token, option);
      setSelectedByRound((current) => ({ ...current, [round.id]: option }));
      setQuizState((current) => current?.round?.id === round.id
        ? { ...current, round: { ...current.round, answered: true } }
        : current);
    } catch (error) {
      const code = getQuizErrorCode(error);
      if (code === "ALREADY_ANSWERED") {
        setQuizState((current) => current?.round?.id === round.id
          ? { ...current, round: { ...current.round, answered: true } }
          : current);
      } else {
        answerLocks.current.delete(round.id);
      }
      setActionError(mapQuizError(error, "Cevap gönderilemedi. Lütfen tekrar dene."));
    } finally {
      setSubmittingRound(null);
    }
  }

  const selectedOption = useMemo(() => {
    const roundId = quizState?.round?.id;
    return roundId && selectedByRound[roundId] !== undefined ? selectedByRound[roundId] : null;
  }, [quizState?.round?.id, selectedByRound]);

  if (booting) return <LoadingScreen label="Oturum kontrol ediliyor…" />;

  if (screen === "home") {
    return <HomeScreen onCreate={() => { setActionError(null); setScreen("create"); }} onJoin={() => { setActionError(null); setScreen("join"); }} />;
  }

  if (screen === "create") {
    return <CreateRoomScreen error={actionError} pending={pending} onBack={() => setScreen("home")} onSubmit={handleCreate} />;
  }

  if (screen === "join") {
    return <JoinRoomScreen error={actionError} pending={pending} onBack={() => setScreen("home")} onSubmit={handleJoin} />;
  }

  if (!session || !quizState) {
    return <LoadingScreen label={connectionError ?? "Odaya bağlanılıyor…"} />;
  }

  if (quizState.room.status === "finished") {
    return (
      <FinalScreen
        players={quizState.players}
        currentPlayerId={session.playerId}
        onHome={() => resetTo("home")}
        onCreateRoom={() => resetTo("create")}
      />
    );
  }

  if (quizState.room.status === "waiting") {
    return (
      <LobbyScreen
        room={quizState.room}
        players={quizState.players}
        currentPlayerId={session.playerId}
        error={actionError ?? connectionError}
        starting={starting}
        onStart={handleStart}
      />
    );
  }

  return (
    <GameScreen
      round={quizState.round}
      reveal={quizState.reveal}
      players={quizState.players}
      currentPlayerId={session.playerId}
      totalQuestions={quizState.room.question_count}
      serverOffsetMs={serverOffsetMs}
      selectedOption={selectedOption}
      submitting={submittingRound === quizState.round?.id}
      error={actionError ?? connectionError}
      onAnswer={handleAnswer}
    />
  );
}
