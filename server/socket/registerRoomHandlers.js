import { RoomError, serializeRoom } from '../room/roomService.js';
import { GameError } from '../game/gameSession.js';
import { ERROR_TEXT } from '../../src/content/text.js';

const channelFor = (roomId) => `room:${roomId}`;
const RECONNECT_GRACE_PERIOD = 30_000;
const disconnectTimers = new Map();

function emitRoomState(io, room) {
  io.to(channelFor(room.id)).emit('room:state', serializeRoom(room));
}

function sendResult(callback, action) {
  try {
    callback({ ok: true, ...action() });
  } catch (error) {
    const isExpectedError = error instanceof RoomError || error instanceof GameError;
    if (!isExpectedError) console.error(error);
    callback({
      ok: false,
      error: {
        code: isExpectedError ? error.code : 'INTERNAL_ERROR',
        message: isExpectedError ? error.message : ERROR_TEXT.server,
      },
    });
  }
}

export function registerRoomHandlers(io, socket, roomService) {
  function enterRoom(event, payload, callback) {
    sendResult(callback, () => {
      const previousRoom = roomService.getRoomBySocketId(socket.id);
      const { room, player } = roomService[event]({ socketId: socket.id, ...payload });

      if (previousRoom && previousRoom.id !== room.id) {
        socket.leave(channelFor(previousRoom.id));
        emitRoomState(io, previousRoom);
      }

      socket.join(channelFor(room.id));
      queueMicrotask(() => emitRoomState(io, room));
      return {
        room: serializeRoom(room),
        selfId: player.id,
        reconnectToken: player.reconnectToken,
      };
    });
  }

  socket.on('room:create', (payload, callback) => enterRoom('create', payload, callback));
  socket.on('room:join', (payload, callback) => enterRoom('join', payload, callback));

  socket.on('room:resume', (payload, callback) => {
    sendResult(callback, () => {
      const { room, player } = roomService.resume({ socketId: socket.id, ...payload });
      const timer = disconnectTimers.get(player.id);
      if (timer) clearTimeout(timer);
      disconnectTimers.delete(player.id);
      socket.join(channelFor(room.id));
      queueMicrotask(() => emitRoomState(io, room));
      return { room: serializeRoom(room), selfId: player.id };
    });
  });

  socket.on('room:start', (callback) => {
    sendResult(callback, () => {
      const room = roomService.start(socket.id);
      queueMicrotask(() => emitRoomState(io, room));
      return { room: serializeRoom(room) };
    });
  });

  socket.on('game:place', (move, callback) => {
    sendResult(callback, () => {
      const room = roomService.place(socket.id, move);
      queueMicrotask(() => emitRoomState(io, room));
      return { room: serializeRoom(room) };
    });
  });

  socket.on('game:rematch', (callback) => {
    sendResult(callback, () => {
      const room = roomService.rematch(socket.id);
      queueMicrotask(() => emitRoomState(io, room));
      return { room: serializeRoom(room) };
    });
  });

  socket.on('game:return-lobby', (callback) => {
    sendResult(callback, () => {
      const room = roomService.returnToLobby(socket.id);
      queueMicrotask(() => emitRoomState(io, room));
      return { room: serializeRoom(room) };
    });
  });

  socket.on('room:leave', (callback = () => {}) => {
    const currentRoom = roomService.getRoomBySocketId(socket.id);
    const result = roomService.leave(socket.id);
    if (currentRoom) socket.leave(channelFor(currentRoom.id));
    if (result?.room) emitRoomState(io, result.room);
    callback({ ok: true });
  });

  socket.on('disconnect', () => {
    const result = roomService.disconnect(socket.id);
    if (!result?.room) return;

    emitRoomState(io, result.room);
    const roomId = result.room.id;
    const timer = setTimeout(() => {
      disconnectTimers.delete(result.playerId);
      const removalResult = roomService.removeDisconnected(roomId, result.playerId);
      if (removalResult?.room) emitRoomState(io, removalResult.room);
    }, RECONNECT_GRACE_PERIOD);
    disconnectTimers.set(result.playerId, timer);
  });
}
