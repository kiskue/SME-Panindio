/**
 * In-app "new product" notification sound.
 * =========================================
 * The OS push owns the sound when the app is backgrounded/closed; the foreground
 * OS sound is intentionally suppressed (`shouldPlaySound: false` in the handler).
 * This module gives the foreground path its own audible cue so a customer who is
 * actively using the app still hears `new_product.wav` alongside the in-app toast.
 *
 * Loaded lazily and guarded exactly like the scanner beep
 * (`components/molecules/BarcodeScannerModal`) so a missing `expo-audio` native
 * module (e.g. in Expo Go, before the dev client is rebuilt) degrades to silence
 * instead of crashing. Playback does NOT override the device audio mode, so it
 * respects the phone's silent/ringer switch — as a notification sound should.
 */

/** Minimal shape of the expo-audio player we actually use. */
type SoundPlayer = {
  seekTo: (seconds: number) => void;
  play: () => void;
};

// Single reused player, created on first play. `undefined` = not yet attempted,
// `null` = attempted and unavailable (module/asset missing) — stay silent.
let player: SoundPlayer | null | undefined;

function getPlayer(): SoundPlayer | null {
  if (player !== undefined) return player;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Audio = require('expo-audio') as {
      createAudioPlayer?: (src: number) => SoundPlayer;
    };
    player =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Audio.createAudioPlayer?.(require('../../../../assets/sounds/new_product.wav')) ?? null;
  } catch {
    player = null; // expo-audio native module or asset missing — silent.
  }
  return player;
}

/** Play the "new product" cue. No-op (never throws) if audio is unavailable. */
export function playNewProductSound(): void {
  try {
    const p = getPlayer();
    if (!p) return;
    p.seekTo(0); // rewind so back-to-back products always play from the start
    p.play();
  } catch {
    // playback failed — silent, never blocks the realtime handler.
  }
}
