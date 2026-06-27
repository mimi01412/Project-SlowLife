import { randomUUID } from 'node:crypto';
import { createGameSession, placeGamePiece, removePlayerFromGame } from '../game/gameSession.js';

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

function createPlayer(socketId, name) {
  return {
    id: randomUUID(),
    reconnectToken: randomUUID(),
    socketId,
    name,
    connected: true,
  };
}

function findPlayerBySocketId(room, socketId) {
  return room.players.find((player) => player.socketId === socketId);
}

export function createRoomService() {
  const rooms = new Map();
  const roomIdBySocketId = new Map();

  function getRoomById(roomId) {
    return rooms.get(roomId) ?? null;
  }

  function getRoomBySocketId(socketId) {
    const roomId = roomIdBySocketId.get(socketId);
    return roomId ? getRoomById(roomId) : null;
  }

  function removePlayer(room, playerId) {
    const playerIndex = room.players.findIndex((player) => player.id === playerId);
    if (playerIndex === -1) return null;

    const [player] = room.players.splice(playerIndex, 1);
    if (player.socketId) roomIdBySocketId.delete(player.socketId);
    removePlayerFromGame(room.game, playerId, room.players);

    if (room.players.length === 0) {
      rooms.delete(room.id);
      return { room: null, deletedRoomId: room.id };
    }

    if (room.hostId === playerId) {
      room.hostId = (room.players.find((candidate) => candidate.connected) ?? room.players[0]).id;
    }
    return { room, deletedRoomId: null };
  }

  function leave(socketId) {
    const room = getRoomBySocketId(socketId);
    if (!room) return null;
    const player = findPlayerBySocketId(room, socketId);
    return player ? removePlayer(room, player.id) : null;
  }

  function disconnect(socketId) {
    const room = getRoomBySocketId(socketId);
    if (!room) return null;
    const player = findPlayerBySocketId(room, socketId);
    if (!player) return null;

    player.connected = false;
    player.socketId = null;
    roomIdBySocketId.delete(socketId);
    return { room, playerId: player.id };
  }

  function removeDisconnected(roomId, playerId) {
    const room = getRoomById(roomId);
    const player = room?.players.find((candidate) => candidate.id === playerId);
    if (!room || !player || player.connected) return null;
    return removePlayer(room, playerId);
  }

  function create({ socketId, name: rawName, roomId: rawRoomId }) {
    const name = validateName(rawName);
    const roomId = validateRoomId(rawRoomId);
    if (rooms.has(roomId)) {
      throw new RoomError('ROOM_EXISTS', 'その合言葉の部屋はすでに存在します。');
    }

    leave(socketId);
    const player = createPlayer(socketId, name);
    const room = {
      id: roomId,
      status: 'lobby',
      hostId: player.id,
      players: [player],
      game: null,
    };

    rooms.set(roomId, room);
    roomIdBySocketId.set(socketId, roomId);
    return { room, player };
  }

  function join({ socketId, name: rawName, roomId: rawRoomId }) {
    const name = validateName(rawName);
    const roomId = validateRoomId(rawRoomId);
    const room = rooms.get(roomId);

    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'その合言葉の部屋は見つかりません。');
    if (room.status !== 'lobby') {
      throw new RoomError('GAME_ALREADY_STARTED', 'この部屋はすでにゲームを開始しています。');
    }
    if (room.players.length >= MAX_PLAYERS) throw new RoomError('ROOM_FULL', 'この部屋は8人で満員です。');
    if (hasSameName(room, name)) {
      throw new RoomError('NAME_TAKEN', '同じ名前のプレイヤーが参加しています。');
    }

    leave(socketId);
    const player = createPlayer(socketId, name);
    room.players.push(player);
    roomIdBySocketId.set(socketId, roomId);
    return { room, player };
  }

  function resume({ socketId, roomId: rawRoomId, reconnectToken }) {
    const roomId = validateRoomId(rawRoomId);
    const room = rooms.get(roomId);
    const player = room?.players.find((candidate) => candidate.reconnectToken === reconnectToken);

    if (!room || !player) throw new RoomError('SESSION_NOT_FOUND', '復帰できるセッションがありません。');
    if (player.connected) throw new RoomError('SESSION_IN_USE', 'このプレイヤーはすでに接続しています。');

    leave(socketId);
    player.socketId = socketId;
    player.connected = true;
    roomIdBySocketId.set(socketId, room.id);
    return { room, player };
  }

  function start(socketId) {
    const room = getRoomBySocketId(socketId);
    const player = room ? findPlayerBySocketId(room, socketId) : null;
    if (!room || !player) throw new RoomError('NOT_IN_ROOM', '参加中の部屋がありません。');
    if (room.hostId !== player.id) {
      throw new RoomError('NOT_HOST', 'ゲームを開始できるのはホストだけです。');
    }
    if (room.status !== 'lobby') {
      throw new RoomError('GAME_ALREADY_STARTED', 'ゲームはすでに開始しています。');
    }

    room.status = 'playing';
    room.game = createGameSession(room.players);
    return room;
  }

  function place(socketId, move) {
    const room = getRoomBySocketId(socketId);
    const player = room ? findPlayerBySocketId(room, socketId) : null;
    if (!room || !player || !room.game) throw new RoomError('GAME_NOT_FOUND', '参加中のゲームがありません。');

    const result = placeGamePiece(room.game, player.id, move, room.players);
    if (result.finished) room.status = 'finished';
    return room;
  }

  return {
    create,
    join,
    resume,
    start,
    place,
    leave,
    disconnect,
    removeDisconnected,
    getRoomById,
    getRoomBySocketId,
  };
}

export function serializeRoom(room) {
  return {
    id: room.id,
    status: room.status,
    hostId: room.hostId,
    maxPlayers: MAX_PLAYERS,
    players: room.players.map(({ id, name, connected }) => ({ id, name, connected })),
    game: room.game,
  };
}
