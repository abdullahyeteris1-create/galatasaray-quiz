export function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    throw new Error("Sunucudan geçersiz bir zaman değeri geldi.");
  }

  return timestamp;
}

export function calculateServerOffset(
  serverNow: string,
  requestStartedAt: number,
  responseReceivedAt: number,
): number {
  const requestMidpoint = requestStartedAt + (responseReceivedAt - requestStartedAt) / 2;
  return toTimestamp(serverNow) - requestMidpoint;
}

export function serverNow(serverOffsetMs: number): number {
  return Date.now() + serverOffsetMs;
}

export function secondsUntil(target: string, serverOffsetMs: number): number {
  return Math.max(0, Math.ceil((toTimestamp(target) - serverNow(serverOffsetMs)) / 1000));
}

