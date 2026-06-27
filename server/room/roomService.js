const MAX_PLAYERS = 8;
const MAX_NAME_LENGTH = 16;
const MIN_ROOM_ID_LENGTH = 2;
const MAX_ROOM_ID_LENGTH = 24;

export class RoomError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RoomError';
    this.code = code;
  }
}

function normalize(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function validateName(value) {
  const name = normalize(value);
  if (!name) throw new RoomError('INVALID_NAME', '名前を入力してください。');
  if (name.length > MAX_NAME_LENGTH) {
    throw new RoomError('INVALID_NAME', `名前は${MAX_NAME_LENGTH}文字以内で入力してください。`);
  }
  return name;
}

function validateRoomId(value) {
  const roomId = normalize(value);
  if (roomId.length < MIN_ROOM_ID_LENGTH || roomId.length > MAX_ROOM_ID_LENGTH) {
    throw new RoomError(
      'INVALID_ROOM_ID',
      `合言葉は${MIN_ROOM_ID_LENGTH}～${MAX_ROOM_ID_LENGTH}文字で入力してください。`,
    );
  }
  return roomId;
}

function hasSameName(room, name) {
  const comparableName = name.toLocaleLowerCase('ja');
  return room.players.some((player) => player.name.toLocaleLowerCase('ja') === comparableName);
}

export function createRoomService() {
  const rooms = new Map();
  const roomIdBySocketId = new Map();

  function getRoomBySocketId(socketId) {
    const roomId = roomIdBySocketId.get(socketId);
    return roomId ? rooms.get(roomId) : null;
  }

  function leave(socketId) {
    const room = getRoomBySocketId(socketId);
    if (!room) return null;

    const playerIndex = room.players.findIndex((player) => player.id === socketId);
    if (playerIndex !== -1) room.players.splice(playerIndex, 1);
    roomIdBySocketId.delete(socketId);

    if (room.players.length === 0) {
      rooms.delete(room.id);
      return { room: null, deletedRoomId: room.id };
    }

    if (room.hostId === socketId) room.hostId = room.players[0].id;
    return { room, deletedRoomId: null };
  }

  function create({ socketId, name: rawName, roomId: rawRoomId }) {
    const name = validateName(rawName);
    const roomId = validateRoomId(rawRoomId);

    if (rooms.has(roomId)) {
      throw new RoomError('ROOM_EXISTS', 'その合言葉の部屋はすでに存在します。');
    }

    leave(socketId);
    const player = { id: socketId, name };
    const room = {
      id: roomId,
      status: 'lobby',
      hostId: socketId,
      players: [player],
    };

    rooms.set(roomId, room);
    roomIdBySocketId.set(socketId, roomId);
    return room;
  }

  function join({ socketId, name: rawName, roomId: rawRoomId }) {
    const name = validateName(rawName);
    const roomId = validateRoomId(rawRoomId);
    const room = rooms.get(roomId);

    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'その合言葉の部屋は見つかりません。');
    if (room.status !== 'lobby') {
      throw new RoomError('GAME_ALREADY_STARTED', 'この部屋はすでにゲームを開始しています。');
    }
    if (room.players.length >= MAX_PLAYERS) {
      throw new RoomError('ROOM_FULL', 'この部屋は8人で満員です。');
    }
    if (hasSameName(room, name)) {
      throw new RoomError('NAME_TAKEN', '同じ名前のプレイヤーが参加しています。');
    }

    leave(socketId);
    room.players.push({ id: socketId, name });
    roomIdBySocketId.set(socketId, roomId);
    return room;
  }

  return { create, join, leave, getRoomBySocketId };
}

export function serializeRoom(room) {
  return {
    id: room.id,
    status: room.status,
    hostId: room.hostId,
    maxPlayers: MAX_PLAYERS,
    players: room.players.map(({ id, name }) => ({ id, name })),
  };
}
