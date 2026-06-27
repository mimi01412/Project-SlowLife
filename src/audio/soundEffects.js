import { SOUND_EFFECTS } from '../content/assets.js';

const sounds = new Map(
  Object.entries(SOUND_EFFECTS).map(([name, source]) => {
    const audio = new Audio(source);
    audio.preload = 'auto';
    audio.volume = 0.35;
    return [name, audio];
  }),
);

function playSound(name) {
  const audio = sounds.get(name);
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {
    // ブラウザが音声再生を制限していてもゲームは続行します。
  });
}

export function playPlacementSound() {
  playSound('placement');
}

export function playLineClearSound() {
  playSound('lineClear');
}

export function playTurnSound() {
  playSound('myTurn');
}

export function setSoundEffectsMuted(muted) {
  sounds.forEach((audio) => {
    audio.muted = muted;
  });
}
