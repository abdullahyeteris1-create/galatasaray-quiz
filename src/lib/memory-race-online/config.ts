export const MEMORY_RACE_LEVELS = {
  1: { label: "Başlangıç", cards: 16, pairs: 8, seconds: 45 },
  2: { label: "Kolay", cards: 20, pairs: 10, seconds: 50 },
  3: { label: "Orta", cards: 24, pairs: 12, seconds: 55 },
  4: { label: "İleri", cards: 32, pairs: 16, seconds: 65 },
  5: { label: "Usta", cards: 40, pairs: 20, seconds: 75 },
  6: { label: "Efsane", cards: 60, pairs: 30, seconds: 90 },
} as const;

export type MemoryRaceLevel = keyof typeof MEMORY_RACE_LEVELS;
export const MEMORY_RACE_MAX_PLAYERS = [2, 4, 6, 8] as const;
export const MEMORY_RACE_ROUNDS = [3, 5, 10] as const;
export type MemoryRaceSession = { roomId: string; playerId: string; token: string; code: string };

export function createBoard(level: MemoryRaceLevel) {
  const emojis = MEMORY_RACE_CARD_VISUALS[level];
  return [...emojis.slice(0, MEMORY_RACE_LEVELS[level].pairs).flatMap((value, pair) => [{ id: `${pair}-a`, pair, value }, { id: `${pair}-b`, pair, value }])].sort(() => Math.random() - 0.5);
}
import { MEMORY_RACE_CARD_VISUALS } from "@/lib/memory-race/cardVisuals";
