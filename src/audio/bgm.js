const audio = new Audio();
audio.loop = true;
audio.preload = 'auto';
audio.volume = 0.35;

let targetSource = null;
let loadedSource = null;
let playRequestId = 0;

const unlockEvents = ['pointerdown', 'keydown'];

function removeUnlockListeners() {
  unlockEvents.forEach((eventName) => {
    window.removeEventListener(eventName, unlockPlayback, true);
  });
}

function addUnlockListeners() {
  unlockEvents.forEach((eventName) => {
    window.addEventListener(eventName, unlockPlayback, true);
  });
}

async function playTarget() {
  if (!targetSource) return;

  const requestId = ++playRequestId;
  if (loadedSource !== targetSource) {
    loadedSource = targetSource;
    audio.src = targetSource;
    audio.load();
  }

  try {
    await audio.play();
    if (requestId === playRequestId) removeUnlockListeners();
  } catch {
    // 自動再生が制限された場合は、次のユーザー操作時に再試行します。
    if (requestId === playRequestId && targetSource) addUnlockListeners();
  }
}

function unlockPlayback() {
  playTarget();
}

export function setBgm(source) {
  if (targetSource === source && !audio.paused) return;
  targetSource = source;
  playTarget();
}

export function stopBgm() {
  playRequestId += 1;
  targetSource = null;
  audio.pause();
  audio.currentTime = 0;
  removeUnlockListeners();
}
