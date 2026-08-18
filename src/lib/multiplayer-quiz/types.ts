export type MultiplayerSession = {
  version: 1;
  roomId: string;
  playerId: string;
  token: string;
  code: string;
};

export type MultiplayerCredentials = {
  room_id: string;
  code: string;
  player_id: string;
  token: string;
};

export type MultiplayerRoom = {
  status: string;
  host_player_id: string;
};

export type MultiplayerRound = {
  id: string;
  answered: boolean;
};

export type MultiplayerReveal = {
  correct_option: number;
};

export type MultiplayerState = {
  room: MultiplayerRoom;
  round: MultiplayerRound | null;
  reveal: MultiplayerReveal | null;
};

export type SyncedMultiplayerState<State extends MultiplayerState> = {
  state: State;
  serverOffsetMs: number;
};

export type MultiplayerScreen = "home" | "create" | "join" | "session";
