const ERROR_MESSAGES: Record<string, string> = {
  ROOM_NOT_FOUND: "Oda bulunamadı.",
  ROOM_FULL: "Oda dolu.",
  ROOM_ALREADY_STARTED: "Oyun zaten başladı.",
  NAME_TAKEN: "Bu isim odada kullanılıyor.",
  ROOM_EXPIRED: "Odanın süresi dolmuş.",
  INVALID_CAPACITY: "Oyuncu kapasitesi 2 ile 12 arasında olmalı.",
  NEED_AT_LEAST_2_PLAYERS: "Oyunu başlatmak için en az 2 oyuncu gerekli.",
  NEED_EXACTLY_2_PLAYERS: "Oyunu başlatmak için tam 2 oyuncu gerekli.",
  HOST_ONLY: "Bu işlemi yalnızca oda sahibi yapabilir.",
  ALREADY_ANSWERED: "Bu soru için cevabın zaten alındı.",
  ROUND_CLOSED: "Bu soru artık cevap kabul etmiyor.",
  ROUND_NOT_STARTED: "Soru henüz başlamadı.",
  UNAUTHORIZED_PLAYER: "Oyuncu oturumu geçersiz. Lütfen odaya yeniden katıl.",
};

const INVALID_SESSION_ERRORS = new Set([
  "ROOM_NOT_FOUND",
  "ROOM_EXPIRED",
  "UNAUTHORIZED_PLAYER",
]);

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const candidate = error as Record<string, unknown>;
    return [candidate.code, candidate.message, candidate.details, candidate.hint]
      .filter((value): value is string => typeof value === "string")
      .join(" ");
  }

  return "";
}

export function getQuizErrorCode(error: unknown): string | null {
  const text = errorText(error).toUpperCase();
  return Object.keys(ERROR_MESSAGES).find((code) => text.includes(code)) ?? null;
}

export function mapQuizError(
  error: unknown,
  fallback = "İşlem tamamlanamadı. Lütfen tekrar dene.",
): string {
  const code = getQuizErrorCode(error);
  return code ? ERROR_MESSAGES[code] : fallback;
}

export function isInvalidSessionError(error: unknown): boolean {
  const code = getQuizErrorCode(error);
  return code ? INVALID_SESSION_ERRORS.has(code) : false;
}
