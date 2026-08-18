import { getSupabaseClient } from "@/lib/supabase/client";
import { calculateServerOffset } from "@/lib/quiz/time";

export function unwrapRpcResult<T>(data: unknown, functionName: string): T {
  const value = Array.isArray(data) ? data[0] : data;

  if (!value || typeof value !== "object") {
    throw new Error(`${functionName} beklenen yanıtı döndürmedi.`);
  }

  return value as T;
}

export async function multiplayerRpc<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await getSupabaseClient().rpc(name, args);
  if (error) throw error;
  return unwrapRpcResult<T>(data, name);
}

export async function multiplayerRpcVoid(
  name: string,
  args: Record<string, unknown>,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc(name, args);
  if (error) throw error;
}

export async function getSyncedMultiplayerState<State extends { server_now: string }>(
  name: string,
  args: Record<string, unknown>,
): Promise<{ state: State; serverOffsetMs: number }> {
  const requestStartedAt = Date.now();
  const state = await multiplayerRpc<State>(name, args);
  const responseReceivedAt = Date.now();

  return {
    state,
    serverOffsetMs: calculateServerOffset(
      state.server_now,
      requestStartedAt,
      responseReceivedAt,
    ),
  };
}
