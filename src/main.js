import './style.css';
import { createRoomClient } from './network/roomClient.js';
import { createEntryFlow } from './ui/entryFlow.js';
import { renderLobby } from './ui/lobbyView.js';

const app = document.querySelector('#app');
const roomClient = createRoomClient();
let currentRoom = null;
let selfId = null;

function showLobby() {
  if (!currentRoom) return;
  renderLobby(app, {
    room: currentRoom,
    selfId,
    async onLeave() {
      await roomClient.leaveRoom();
      currentRoom = null;
      selfId = null;
      showEntry();
    },
  });
}

function showEntry() {
  createEntryFlow(app, {
    async onRoomRequest({ type, playerName, roomId }) {
      const action = type === 'create' ? roomClient.createRoom : roomClient.joinRoom;
      const response = await action({ name: playerName, roomId });
      currentRoom = response.room;
      selfId = response.selfId;
      showLobby();
    },
  });
}

roomClient.onRoomState((room) => {
  if (!currentRoom || currentRoom.id !== room.id) return;
  currentRoom = room;
  showLobby();
});

showEntry();
