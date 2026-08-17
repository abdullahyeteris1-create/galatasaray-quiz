export const SOUND_PREFERENCE_KEY = "gs_quiz_sound_enabled";

const LOBBY_VOLUME = 0.24;
const FADE_DURATION_MS = 500;

type AudioContextWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

class AudioManager {
  private lobbyAudio: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private enabled = true;
  private activated = false;
  private lobbyRequested = false;
  private fadeTimer: number | null = null;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;

    if (!enabled) {
      this.stopLobbyImmediately();
      void this.context?.suspend().catch(() => undefined);
      return;
    }

    if (this.lobbyRequested && this.activated) {
      void this.playLobby();
    }
  }

  setLobbyActive(active: boolean) {
    this.lobbyRequested = active;

    if (!active) {
      this.fadeOutLobby();
      return;
    }

    if (this.enabled && this.activated) {
      void this.playLobby();
    }
  }

  activate() {
    this.activated = true;

    const context = this.getAudioContext();
    if (context) void context.resume().catch(() => undefined);

    if (this.enabled && this.lobbyRequested) {
      void this.playLobby();
    }
  }

  playRevealEffect(correct: boolean) {
    if (!this.enabled || !this.activated) return;

    const context = this.getAudioContext();
    if (!context) return;

    void context.resume().catch(() => undefined);

    const now = context.currentTime;
    const notes = correct
      ? [{ frequency: 523.25, start: 0, duration: 0.28 }, { frequency: 783.99, start: 0.24, duration: 0.42 }]
      : [{ frequency: 220, start: 0, duration: 0.25 }, { frequency: 164.81, start: 0.22, duration: 0.34 }];

    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + note.start;
      const end = start + note.duration;

      oscillator.type = correct ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(note.frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.52, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
  }

  private getLobbyAudio() {
    if (this.lobbyAudio) return this.lobbyAudio;

    const audio = new Audio("/audio/lobby-music.mp3");
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = LOBBY_VOLUME;
    this.lobbyAudio = audio;
    return audio;
  }

  private getAudioContext() {
    if (this.context) return this.context;
    if (typeof window === "undefined") return null;

    const audioWindow = window as AudioContextWindow;
    const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextConstructor) return null;

    try {
      this.context = new AudioContextConstructor();
    } catch {
      return null;
    }
    return this.context;
  }

  private async playLobby() {
    if (!this.enabled || !this.activated || !this.lobbyRequested) return;

    const audio = this.getLobbyAudio();
    this.cancelFade();
    audio.volume = LOBBY_VOLUME;

    try {
      await audio.play();
      if (!this.enabled || !this.lobbyRequested) this.fadeOutLobby();
    } catch {
      // Autoplay and media-loading failures must never affect the game flow.
    }
  }

  private fadeOutLobby() {
    const audio = this.lobbyAudio;
    if (!audio || audio.paused) return;

    this.cancelFade();
    const initialVolume = audio.volume;
    const startedAt = performance.now();

    this.fadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / FADE_DURATION_MS);
      audio.volume = Math.max(0, initialVolume * (1 - progress));

      if (progress >= 1) {
        this.cancelFade();
        audio.pause();
        audio.volume = LOBBY_VOLUME;
      }
    }, 40);
  }

  private stopLobbyImmediately() {
    this.cancelFade();
    if (!this.lobbyAudio) return;

    this.lobbyAudio.pause();
    this.lobbyAudio.volume = LOBBY_VOLUME;
  }

  private cancelFade() {
    if (this.fadeTimer === null) return;
    window.clearInterval(this.fadeTimer);
    this.fadeTimer = null;
  }
}

let manager: AudioManager | null = null;

export function getAudioManager() {
  if (!manager) manager = new AudioManager();
  return manager;
}
