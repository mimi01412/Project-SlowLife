import './style.css';
import { createRoomClient } from './network/roomClient.js';
import { createEntryFlow } from './ui/entryFlow.js';
import { renderGameView } from './ui/gameView.js';
import { renderLobby } from './ui/lobbyView.js';
import { renderResultView } from './ui/resultView.js';
import { UI_TEXT } from './content/text.js';
import { BGM_TRACKS } from './content/assets.js';
import { setBgm, setBgmMuted, setBgmVolume, stopBgm } from './audio/bgm.js';
import {
  playLineClearSound,
  playPlacementSound,
  playTurnSound,
  setSoundEffectsMuted,
  setSoundEffectsVolume,
} from './audio/soundEffects.js';

const SESSION_KEY = 'slow-life-room-session';
const AUDIO_MUTED_KEY = 'slow-life-audio-muted';
const BGM_VOLUME_KEY = 'slow-life-bgm-volume';
const SE_VOLUME_KEY = 'slow-life-se-volume';
const app = document.querySelector('#app');
const audioToggle = document.querySelector('#audio-toggle');
const volumeToggle = document.querySelector('#volume-toggle');
const volumePanel = document.querySelector('#volume-panel');
const bgmVolumeInput = document.querySelector('#bgm-volume');
const seVolumeInput = document.querySelector('#se-volume');
const bgmVolumeValue = document.querySelector('#bgm-volume-value');
const seVolumeValue = document.querySelector('#se-volume-value');
document.title = UI_TEXT.common.pageTitle;
const roomClient = createRoomClient();
let currentRoom = null;
let selfId = null;
let destroyCurrentView = () => {};
let lastChimedTurn = null;
const observedPlacementIds = new Map();
const observedClearIds = new Map();

function loadMutedSetting() {
  try {
    return localStorage.getItem(AUDIO_MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadVolumeSetting(key, fallback) {
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue === null) return fallback;
    const value = Number(storedValue);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {}
}

function applyMutedSetting(muted) {
  setBgmMuted(muted);
  setSoundEffectsMuted(muted);
  audioToggle.classList.toggle('is-muted', muted);
  audioToggle.setAttribute('aria-pressed', String(muted));
  const label = muted ? 'ミュートを解除' : '音声をミュート';
  audioToggle.setAttribute('aria-label', label);
  audioToggle.title = label;
}

let isAudioMuted = loadMutedSetting();
const initialBgmVolume = loadVolumeSetting(BGM_VOLUME_KEY, 18);
const initialSeVolume = loadVolumeSetting(SE_VOLUME_KEY, 35);
applyMutedSetting(isAudioMuted);
bgmVolumeInput.value = String(initialBgmVolume);
seVolumeInput.value = String(initialSeVolume);
bgmVolumeValue.textContent = `${initialBgmVolume}%`;
seVolumeValue.textContent = `${initialSeVolume}%`;
setBgmVolume(initialBgmVolume / 100);
setSoundEffectsVolume(initialSeVolume / 100);
audioToggle.addEventListener('click', () => {
  isAudioMuted = !isAudioMuted;
  applyMutedSetting(isAudioMuted);
  saveSetting(AUDIO_MUTED_KEY, isAudioMuted);
});

volumeToggle.addEventListener('click', () => {
  const willOpen = volumePanel.hidden;
  volumePanel.hidden = !willOpen;
  volumeToggle.setAttribute('aria-expanded', String(willOpen));
});

bgmVolumeInput.addEventListener('input', () => {
  const volume = Number(bgmVolumeInput.value);
  bgmVolumeValue.textContent = `${volume}%`;
  setBgmVolume(volume / 100);
  saveSetting(BGM_VOLUME_KEY, volume);
});

seVolumeInput.addEventListener('input', () => {
  const volume = Number(seVolumeInput.value);
  seVolumeValue.textContent = `${volume}%`;
  setSoundEffectsVolume(volume / 100);
  saveSetting(SE_VOLUME_KEY, volume);
});

document.addEventListener('pointerdown', (event) => {
  if (volumePanel.hidden || event.target.closest('.audio-controls')) return;
  volumePanel.hidden = true;
  volumeToggle.setAttribute('aria-expanded', 'false');
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || volumePanel.hidden) return;
  volumePanel.hidden = true;
  volumeToggle.setAttribute('aria-expanded', 'false');
  volumeToggle.focus();
});

function chimeIfMyTurn() {
  if (currentRoom?.status !== 'playing' || currentRoom.game?.currentPlayerId !== selfId) return;
  const { currentPlayerId, turnNumber, turnEndsAt } = currentRoom.game;
  const turnKey = `${currentRoom.id}:${currentPlayerId}:${turnNumber}:${turnEndsAt}`;
  if (turnKey === lastChimedTurn) return;
  lastChimedTurn = turnKey;
  playTurnSound();
}

function soundIfPiecePlaced() {
  const placementId = currentRoom?.game?.lastPlacementId ?? null;
  const previousId = observedPlacementIds.get(currentRoom.id);
  const hasObservedRoom = observedPlacementIds.has(currentRoom.id);
  observedPlacementIds.set(currentRoom.id, placementId);
  if (hasObservedRoom && placementId && placementId !== previousId) playPlacementSound();
}

function soundIfLinesCleared() {
  const clearId = currentRoom?.game?.lastClear?.id ?? null;
  const previousId = observedClearIds.get(currentRoom.id);
  const hasObservedRoom = observedClearIds.has(currentRoom.id);
  observedClearIds.set(currentRoom.id, clearId);
  if (hasObservedRoom && clearId && clearId !== previousId) playLineClearSound();
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function saveSession(roomId, reconnectToken) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, reconnectToken }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function leaveCurrentRoom() {
  await roomClient.leaveRoom();
  currentRoom = null;
  selfId = null;
  clearSession();
  showEntry();
}

function showRoom() {
  if (!currentRoom) return;
  destroyCurrentView();
  destroyCurrentView = () => {};
  soundIfPiecePlaced();
  soundIfLinesCleared();

  if (currentRoom.status === 'finished') {
    stopBgm();
    renderResultView(app, {
      room: currentRoom,
      selfId,
      onLeave: leaveCurrentRoom,
      async onRematch() {
        const response = await roomClient.rematch();
        currentRoom = response.room;
        showRoom();
      },
      async onReturnLobby() {
        const response = await roomClient.returnToLobby();
        currentRoom = response.room;
        showRoom();
      },
    });
    return;
  }

  if (currentRoom.status === 'playing') {
    setBgm(BGM_TRACKS.playing);
    chimeIfMyTurn();
    destroyCurrentView = renderGameView(app, {
      room: currentRoom,
      selfId,
      onLeave: leaveCurrentRoom,
      async onPlace(move) {
        const response = await roomClient.placePiece(move);
        currentRoom = response.room;
        showRoom();
      },
    });
    return;
  }

  setBgm(BGM_TRACKS.beforePlay);
  renderLobby(app, {
    room: currentRoom,
    selfId,
    onLeave: leaveCurrentRoom,
    async onStart() {
      const response = await roomClient.startRoom();
      currentRoom = response.room;
      showRoom();
    },
  });
}

function showEntry() {
  destroyCurrentView();
  destroyCurrentView = () => {};
  setBgm(BGM_TRACKS.beforePlay);
  createEntryFlow(app, {
    async onRoomRequest({ type, playerName, roomId }) {
      const action = type === 'create' ? roomClient.createRoom : roomClient.joinRoom;
      const response = await action({ name: playerName, roomId });
      currentRoom = response.room;
      selfId = response.selfId;
      saveSession(roomId, response.reconnectToken);
      showRoom();
    },
  });
}

async function resumeSavedSession() {
  const session = loadSession();
  if (!session?.roomId || !session?.reconnectToken) return false;

  try {
    const response = await roomClient.resumeRoom(session);
    currentRoom = response.room;
    selfId = response.selfId;
    showRoom();
    return true;
  } catch {
    clearSession();
    return false;
  }
}

roomClient.onRoomState((room) => {
  if (!currentRoom || currentRoom.id !== room.id) return;
  currentRoom = room;
  showRoom();
});

roomClient.onReconnect(async () => {
  if (!(await resumeSavedSession())) showEntry();
});

async function bootstrap() {
  app.innerHTML = `<main class="loading-page" aria-label="${UI_TEXT.common.loading}"><span></span></main>`;
  setBgm(BGM_TRACKS.beforePlay);
  if (!(await resumeSavedSession())) showEntry();
}

bootstrap();
