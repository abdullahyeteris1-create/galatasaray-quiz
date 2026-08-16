export type RoomStatus = "waiting" | "playing" | "finished" | string;

export type QuizSession = {
  version: 1;
  roomId: string;
  playerId: string;
  token: string;
  code: string;
};

export type RoomCredentials = {
  room_id: string;
  code: string;
  player_id: string;
  token: string;
};

export type QuizRoom = {
  id: string;
  code: string;
  status: RoomStatus;
  max_players: number;
  question_count: number;
  current_round: number;
  host_player_id: string;
};

export type QuizPlayer = {
  id: string;
  name: string;
  score: number;
  correct: number;
  is_host: boolean;
};

export type QuizRound = {
  id: string;
  number: number;
  starts_at: string;
  ends_at: string;
  revealed_at: string | null;
  answered: boolean;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
};

export type QuizReveal = {
  correct_option: number;
  explanation: string;
};

export type QuizState = {
  server_now: string;
  room: QuizRoom;
  players: QuizPlayer[];
  round: QuizRound | null;
  reveal: QuizReveal | null;
};

export type SyncedQuizState = {
  state: QuizState;
  serverOffsetMs: number;
};

export type Screen = "home" | "create" | "join" | "session";
