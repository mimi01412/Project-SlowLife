import './style.css';
import { createRoomClient } from './network/roomClient.js';
import { createEntryFlow } from './ui/entryFlow.js';
import { renderGameView } from './ui/gameView.js';
import { renderLobby } from './ui/lobbyView.js';

const SESSION_KEY = 'slow-life-room-session';
const app = document.querySelector('#app');
const roomClient = createRoomClient();
let currentRoom = null;
let selfId = null;
let destroyCurrentView = () => {};

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

  if (currentRoom.status === 'playing' || currentRoom.status === 'finished') {
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
  app.innerHTML = '<main class="loading-page" aria-label="接続中"><span></span></main>';
  if (!(await resumeSavedSession())) showEntry();
}

bootstrap();
