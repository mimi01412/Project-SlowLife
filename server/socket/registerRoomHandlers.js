import { RoomError, serializeRoom } from '../room/roomService.js';
import { GameError } from '../game/gameSession.js';
import { ERROR_TEXT } from '../../src/content/text.js';

const channelFor = (roomId) => `room:${roomId}`;
const RECONNECT_GRACE_PERIOD = 30_000;
const disconnectTimers = new Map();
const turnTimers = new Map();

function emitRoomState(io, room) {
  io.to(channelFor(room.id)).emit('room:state', serializeRoom(room));
}

function clearTurnTimer(roomId) {
  const timer = turnTimers.get(roomId);
  if (timer) clearTimeout(timer);
  turnTimers.delete(roomId);
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
  function scheduleTurnTimer(room) {
    clearTurnTimer(room.id);
    if (room.status !== 'playing' || !room.game?.turnEndsAt) return;

    const expectedTurnEndsAt = room.game.turnEndsAt;
    const timer = setTimeout(() => {
      turnTimers.delete(room.id);
      const updatedRoom = roomService.expireTurn(room.id, expectedTurnEndsAt);
      if (!updatedRoom) {
        const currentRoom = roomService.getRoomById(room.id);
        if (currentRoom?.game?.turnEndsAt === expectedTurnEndsAt && Date.now() < expectedTurnEndsAt) {
          scheduleTurnTimer(currentRoom);
        }
        return;
      }
      emitRoomState(io, updatedRoom);
      scheduleTurnTimer(updatedRoom);
    }, Math.max(0, expectedTurnEndsAt - Date.now()));
    turnTimers.set(room.id, timer);
  }

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
      scheduleTurnTimer(room);
      queueMicrotask(() => emitRoomState(io, room));
      return { room: serializeRoom(room) };
    });
  });

  socket.on('game:place', (move, callback) => {
    sendResult(callback, () => {
      const room = roomService.place(socket.id, move);
      scheduleTurnTimer(room);
      queueMicrotask(() => emitRoomState(io, room));
      return { room: serializeRoom(room) };
    });
  });

  socket.on('game:rematch', (callback) => {
    sendResult(callback, () => {
      const room = roomService.rematch(socket.id);
      scheduleTurnTimer(room);
      queueMicrotask(() => emitRoomState(io, room));
      return { room: serializeRoom(room) };
    });
  });

  socket.on('game:return-lobby', (callback) => {
    sendResult(callback, () => {
      const room = roomService.returnToLobby(socket.id);
      scheduleTurnTimer(room);
      queueMicrotask(() => emitRoomState(io, room));
      return { room: serializeRoom(room) };
    });
  });

  socket.on('room:leave', (callback = () => {}) => {
    const currentRoom = roomService.getRoomBySocketId(socket.id);
    const result = roomService.leave(socket.id);
    if (currentRoom) socket.leave(channelFor(currentRoom.id));
    if (result?.room) {
      scheduleTurnTimer(result.room);
      emitRoomState(io, result.room);
    } else if (currentRoom) {
      clearTurnTimer(currentRoom.id);
    }
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
      if (removalResult?.room) {
        scheduleTurnTimer(removalResult.room);
        emitRoomState(io, removalResult.room);
      } else if (removalResult?.deletedRoomId) {
        clearTurnTimer(removalResult.deletedRoomId);
      }
    }, RECONNECT_GRACE_PERIOD);
    disconnectTimers.set(result.playerId, timer);
  });
}
