"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { getAudioManager } from "@/lib/audio/audioManager";
import { getQuizErrorCode, isInvalidSessionError, mapQuizError } from "@/lib/quiz/errors";
import type {
  MultiplayerScreen,
  MultiplayerSession,
  MultiplayerState,
  SyncedMultiplayerState,
} from "@/lib/multiplayer-quiz/types";

const audioManager = getAudioManager();

type SessionStore<Session extends MultiplayerSession> = {
  load: () => Session | null;
  save: (session: Session) => void;
  clear: () => void;
};

type MultiplayerLifecycleConfig<
  State extends MultiplayerState,
  Session extends MultiplayerSession,
> = {
  sessionStore: SessionStore<Session>;
  getState: (roomId: string, playerId: string, token: string) => Promise<SyncedMultiplayerState<State>>;
  hostTick: (roomId: string, playerId: string, token: string) => Promise<void>;
  startGame: (roomId: string, playerId: string, token: string) => Promise<void>;
  answerQuestion: (
    roomId: string,
    roundId: string,
    playerId: string,
    token: string,
    selected: number,
  ) => Promise<void>;
  revealStoragePrefix: string;
  onReveal?: (state: State) => void;
};

export function useMultiplayerQuiz<
  State extends MultiplayerState,
  Session extends MultiplayerSession,
>(config: MultiplayerLifecycleConfig<State, Session>) {
  const [screen, setScreen] = useState<MultiplayerScreen>("home");
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<State | null>(null);
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
  const handledRevealRoundIds = useRef(new Set<string>());

  const roomId = session?.roomId ?? null;
  const playerId = session?.playerId ?? null;
  const token = session?.token ?? null;

  function resetTo(screenName: "home" | "create" = "home") {
    audioManager.activate();
    config.sessionStore.clear();
    setSession(null);
    setState(null);
    setSelectedByRound({});
    answerLocks.current.clear();
    handledRevealRoundIds.current.clear();
    setActionError(null);
    setConnectionError(null);
    setScreen(screenName);
  }

  function navigateTo(screenName: "home" | "create" | "join") {
    audioManager.activate();
    setActionError(null);
    setScreen(screenName);
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const storedSession = config.sessionStore.load();
      if (!storedSession) {
        if (!cancelled) setBooting(false);
        return;
      }

      try {
        const synced = await config.getState(
          storedSession.roomId,
          storedSession.playerId,
          storedSession.token,
        );
        if (cancelled) return;

        setSession(storedSession);
        setState(synced.state);
        latestRoundId.current = synced.state.round?.id ?? null;
        setServerOffsetMs(synced.serverOffsetMs);
        setScreen("session");
      } catch (error) {
        if (cancelled) return;

        if (isInvalidSessionError(error)) {
          config.sessionStore.clear();
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
  }, [config]);

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
        const synced = await config.getState(activeRoomId, activePlayerId, activeToken);
        if (stopped) return;

        const nextRoundId = synced.state.round?.id ?? null;
        if (latestRoundId.current !== nextRoundId) {
          latestRoundId.current = nextRoundId;
          setActionError(null);
        }
        setState(synced.state);
        setServerOffsetMs(synced.serverOffsetMs);
        setConnectionError(null);

        if (synced.state.room.status === "finished") return;
        const delay = synced.state.room.status === "waiting" ? 1000 : 650;
        timer = window.setTimeout(poll, delay);
      } catch (error) {
        if (stopped) return;

        if (isInvalidSessionError(error)) {
          config.sessionStore.clear();
          setSession(null);
          setState(null);
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
  }, [booting, config, playerId, roomId, token]);

  const isHostPlaying = Boolean(
    playerId &&
    state &&
    state.room.host_player_id === playerId &&
    state.room.status !== "waiting" &&
    state.room.status !== "finished",
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
        await config.hostTick(activeRoomId, activePlayerId, activeToken);
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
  }, [config, isHostPlaying, playerId, roomId, token]);

  useEffect(() => {
    const lobbyActive = screen !== "session" || state?.room.status === "waiting";
    audioManager.setLobbyActive(lobbyActive);
  }, [screen, state?.room.status]);

  async function openSession(nextSession: Session) {
    config.sessionStore.save(nextSession);
    setState(null);
    setScreen("session");

    try {
      const synced = await config.getState(
        nextSession.roomId,
        nextSession.playerId,
        nextSession.token,
      );
      setState(synced.state);
      latestRoundId.current = synced.state.round?.id ?? null;
      setServerOffsetMs(synced.serverOffsetMs);
      setConnectionError(null);
    } catch (error) {
      setConnectionError(mapQuizError(error, "Odaya bağlanılıyor…"));
    } finally {
      setSession(nextSession);
    }
  }

  async function enterSession(operation: () => Promise<Session>, fallback: string) {
    audioManager.activate();
    setPending(true);
    setActionError(null);
    try {
      await openSession(await operation());
    } catch (error) {
      setActionError(mapQuizError(error, fallback));
    } finally {
      setPending(false);
    }
  }

  async function startGame() {
    if (!session || starting) return;
    audioManager.activate();
    setStarting(true);
    setActionError(null);
    try {
      await config.startGame(session.roomId, session.playerId, session.token);
    } catch (error) {
      setActionError(mapQuizError(error, "Oyun başlatılamadı. Lütfen tekrar dene."));
    } finally {
      setStarting(false);
    }
  }

  async function answerQuestion(option: number) {
    const round = state?.round;
    if (!session || !round || round.answered || answerLocks.current.has(round.id)) return;

    answerLocks.current.add(round.id);
    setSubmittingRound(round.id);
    setActionError(null);

    try {
      await config.answerQuestion(
        session.roomId,
        round.id,
        session.playerId,
        session.token,
        option,
      );
      setSelectedByRound((current) => ({ ...current, [round.id]: option }));
      setState((current) => current?.round?.id === round.id
        ? { ...current, round: { ...current.round, answered: true } }
        : current);
    } catch (error) {
      const code = getQuizErrorCode(error);
      if (code === "ALREADY_ANSWERED") {
        setState((current) => current?.round?.id === round.id
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
    const roundId = state?.round?.id;
    return roundId && selectedByRound[roundId] !== undefined ? selectedByRound[roundId] : null;
  }, [selectedByRound, state?.round?.id]);

  useEffect(() => {
    const reveal = state?.reveal;
    const roundId = state?.round?.id;
    if (!reveal || !roundId || handledRevealRoundIds.current.has(roundId)) return;

    handledRevealRoundIds.current.add(roundId);
    config.onReveal?.(state);

    const sessionKey = `${config.revealStoragePrefix}:${roundId}`;
    try {
      if (window.sessionStorage.getItem(sessionKey) === "1") return;
      window.sessionStorage.setItem(sessionKey, "1");
    } catch {
      // Session storage may be unavailable in private browsing contexts.
    }

    audioManager.playRevealEffect(selectedOption === reveal.correct_option);
  }, [config, selectedOption, state]);

  return {
    actionError,
    answerQuestion,
    booting,
    connectionError,
    enterSession,
    navigateTo,
    pending,
    resetTo,
    screen,
    selectedOption,
    serverOffsetMs,
    session,
    startGame,
    starting,
    state,
    submitting: submittingRound === state?.round?.id,
  };
}
