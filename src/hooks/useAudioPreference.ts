"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { getAudioManager, SOUND_PREFERENCE_KEY } from "@/lib/audio/audioManager";

function readPreference() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== "false";
  } catch {
    return true;
  }
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function savePreference(enabled: boolean) {
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, String(enabled));
  } catch {
    // The audio control still works when storage is blocked.
  }
  const audioManager = getAudioManager();
  audioManager.setEnabled(enabled);
  if (enabled) audioManager.activate();
  listeners.forEach((listener) => listener());
}

export function useAudioPreference() {
  const enabled = useSyncExternalStore(subscribe, readPreference, () => true);

  useEffect(() => {
    getAudioManager().setEnabled(readPreference());
  }, []);

  const toggle = useCallback(() => {
    savePreference(!readPreference());
  }, []);

  return { enabled, toggle };
}
