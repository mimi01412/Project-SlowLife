import { RoomError, serializeRoom } from '../room/roomService.js';

const channelFor = (roomId) => `room:${roomId}`;

function emitRoomState(io, room) {
  io.to(channelFor(room.id)).emit('room:state', serializeRoom(room));
}

function sendResult(callback, action) {
  try {
    callback({ ok: true, ...action() });
  } catch (error) {
    if (!(error instanceof RoomError)) console.error(error);
    callback({
      ok: false,
      error: {
        code: error instanceof RoomError ? error.code : 'INTERNAL_ERROR',
        message: error instanceof RoomError ? error.message : 'サーバーでエラーが発生しました。',
      },
    });
  }
}

export function registerRoomHandlers(io, socket, roomService) {
  function enterRoom(event, payload, callback) {
    sendResult(callback, () => {
      const previousRoom = roomService.getRoomBySocketId(socket.id);
      const room = roomService[event]({ socketId: socket.id, ...payload });

      if (previousRoom && previousRoom.id !== room.id) {
        socket.leave(channelFor(previousRoom.id));
        emitRoomState(io, previousRoom);
      }

      socket.join(channelFor(room.id));
      queueMicrotask(() => emitRoomState(io, room));
      return { room: serializeRoom(room), selfId: socket.id };
    });
  }

  socket.on('room:create', (payload, callback) => enterRoom('create', payload, callback));
  socket.on('room:join', (payload, callback) => enterRoom('join', payload, callback));

  socket.on('room:leave', (callback = () => {}) => {
    const currentRoom = roomService.getRoomBySocketId(socket.id);
    const result = roomService.leave(socket.id);
    if (currentRoom) socket.leave(channelFor(currentRoom.id));
    if (result?.room) emitRoomState(io, result.room);
    callback({ ok: true });
  });

  socket.on('disconnect', () => {
    const result = roomService.leave(socket.id);
    if (result?.room) emitRoomState(io, result.room);
  });
}
