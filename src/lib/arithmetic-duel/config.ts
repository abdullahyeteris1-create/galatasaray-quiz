export type ArithmeticDifficulty = 1 | 2 | 3 | 4;
export type ArithmeticOperation = "mixed" | "addition" | "subtraction" | "multiplication" | "division";
export type ArithmeticRoundCount = 5 | 10 | 15 | 20;
export type ArithmeticTimeLimit = 5 | 7 | 10 | 15;

export const ARITHMETIC_DIFFICULTIES: Array<{ value: ArithmeticDifficulty; label: string }> = [
  { value: 1, label: "Başlangıç" },
  { value: 2, label: "Orta" },
  { value: 3, label: "Zor" },
  { value: 4, label: "Uzman" },
];

export const ARITHMETIC_OPERATIONS: Array<{ value: ArithmeticOperation; label: string }> = [
  { value: "mixed", label: "Karışık" },
  { value: "addition", label: "Toplama" },
  { value: "subtraction", label: "Çıkarma" },
  { value: "multiplication", label: "Çarpma" },
  { value: "division", label: "Bölme" },
];

export const ARITHMETIC_ROUNDS: ArithmeticRoundCount[] = [5, 10, 15, 20];
export const ARITHMETIC_TIMES: ArithmeticTimeLimit[] = [15, 10, 7, 5];

export type ArithmeticDuelSession = { roomId: string; playerId: string; token: string; code: string };
