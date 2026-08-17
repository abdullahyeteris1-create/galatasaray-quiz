export type SuperLigEra = "mixed" | "2000s" | "2010s" | "2020s";

export type SuperLigSession = {
  version: 1;
  roomId: string;
  playerId: string;
  token: string;
  code: string;
};

export type SuperLigCredentials = {
  room_id: string;
  code: string;
  player_id: string;
  token: string;
};

export type SuperLigRoom = {
  id: string;
  code: string;
  status: "waiting" | "playing" | "finished" | string;
  max_players: number;
  question_count: number;
  current_round: number;
  host_player_id: string;
  game_type: "super_lig";
  era: SuperLigEra;
};

export type SuperLigPlayer = {
  id: string;
  name: string;
  score: number;
  correct: number;
  is_host: boolean;
};

export type SuperLigRound = {
  id: string;
  question_id: number;
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

export type SuperLigAnswer = {
  player_id: string;
  selected_option: number;
  response_ms: number;
  is_correct: boolean;
  points_awarded: number;
};

export type SuperLigReveal = {
  correct_option: number;
  explanation: string;
  answers: SuperLigAnswer[];
  winner_id: string | null;
};

export type SuperLigState = {
  server_now: string;
  room: SuperLigRoom;
  players: SuperLigPlayer[];
  round: SuperLigRound | null;
  reveal: SuperLigReveal | null;
};

export type SyncedSuperLigState = {
  state: SuperLigState;
  serverOffsetMs: number;
};
