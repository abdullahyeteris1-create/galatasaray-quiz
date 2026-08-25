// Kaynak Hafıza Yarışı'ndaki emoji setleri. CARD01..CARD30 backend kimlikleridir;
// içerik seviyeyle seçilir, böylece kaynak oyunun seviye havuzları korunur.
export const MEMORY_RACE_CARD_VISUALS = {
  1: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼"],
  2: ["🍎", "🍋", "🍇", "🍊", "🍓", "🍒", "🥝", "🍑", "🍌", "🫐"],
  3: ["⚽", "🏀", "🎾", "🏈", "⚾", "🎱", "🏐", "🏉", "🎿", "⛷️", "🏒", "🥊"],
  4: ["🦁", "🐯", "🐻‍❄️", "🐺", "🦊", "🐗", "🦬", "🦣", "🐘", "🦒", "🐴", "🦧", "🐮", "🦬", "🐑", "🐐"],
  5: ["🌹", "🌻", "🌺", "🌸", "💐", "🌷", "🪻", "🌼", "🏵️", "🪷", "🌿", "🍀", "🍁", "🍂", "🍃", "🌾", "🪴", "🌵", "🎄", "🪹"],
  6: ["🐶", "🐱", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐸", "🐵", "🐙", "🦄", "🐝", "🦋", "🌈", "⭐", "🌙", "☀️", "🍎", "🍋", "🍉", "🍇", "🍓", "⚽", "🏀", "🎯", "🚀", "🎸", "💎", "🔥"],
} as const;

export type MemoryRaceVisualLevel = keyof typeof MEMORY_RACE_CARD_VISUALS;

export function getMemoryRaceCardVisual(level: MemoryRaceVisualLevel, value: string | null) {
  if (!value) return "?";
  const index = Number(value.replace("CARD", "")) - 1;
  return MEMORY_RACE_CARD_VISUALS[level][index] ?? "?";
}
