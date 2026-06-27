import { randomUUID } from 'node:crypto';
import { createGameSession, expireGameTurn, placeGamePiece, removePlayerFromGame } from '../game/gameSession.js';
import { ERROR_TEXT } from '../../src/content/text.js';
import { PLAYER_COLORS } from '../../src/game/playerColors.js';

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
  if (!name) throw new RoomError('INVALID_NAME', ERROR_TEXT.nameRequired);
  if (name.length > MAX_NAME_LENGTH) {
    throw new RoomError('INVALID_NAME', ERROR_TEXT.nameTooLong(MAX_NAME_LENGTH));
  }
  return name;
}

function validateRoomId(value) {
  const roomId = normalize(value);
  if (roomId.length < MIN_ROOM_ID_LENGTH || roomId.length > MAX_ROOM_ID_LENGTH) {
    throw new RoomError(
      'INVALID_ROOM_ID',
      ERROR_TEXT.roomIdLength(MIN_ROOM_ID_LENGTH, MAX_ROOM_ID_LENGTH),
    );
  }
  return roomId;
}

function hasSameName(room, name) {
  const comparableName = name.toLocaleLowerCase('ja');
  return room.players.some((player) => player.name.toLocaleLowerCase('ja') === comparableName);
}

function createPlayer(socketId, name, color) {
  return {
    id: randomUUID(),
    reconnectToken: randomUUID(),
    socketId,
    name,
    color,
    connected: true,
  };
}

function getAvailablePlayerColor(players) {
  const usedColors = new Set(players.map((player) => player.color));
  return PLAYER_COLORS.find((color) => !usedColors.has(color)) ?? PLAYER_COLORS[players.length % PLAYER_COLORS.length];
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
      throw new RoomError('ROOM_EXISTS', ERROR_TEXT.roomExists);
    }

    leave(socketId);
    const player = createPlayer(socketId, name, PLAYER_COLORS[0]);
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

    if (!room) throw new RoomError('ROOM_NOT_FOUND', ERROR_TEXT.roomNotFound);
    if (room.status !== 'lobby') {
      throw new RoomError('GAME_ALREADY_STARTED', ERROR_TEXT.roomAlreadyPlaying);
    }
    if (room.players.length >= MAX_PLAYERS) throw new RoomError('ROOM_FULL', ERROR_TEXT.roomFull(MAX_PLAYERS));
    if (hasSameName(room, name)) {
      throw new RoomError('NAME_TAKEN', ERROR_TEXT.nameTaken);
    }

    leave(socketId);
    const player = createPlayer(socketId, name, getAvailablePlayerColor(room.players));
    room.players.push(player);
    roomIdBySocketId.set(socketId, roomId);
    return { room, player };
  }

  function resume({ socketId, roomId: rawRoomId, reconnectToken }) {
    const roomId = validateRoomId(rawRoomId);
    const room = rooms.get(roomId);
    const player = room?.players.find((candidate) => candidate.reconnectToken === reconnectToken);

    if (!room || !player) throw new RoomError('SESSION_NOT_FOUND', ERROR_TEXT.sessionNotFound);
    if (player.connected) throw new RoomError('SESSION_IN_USE', ERROR_TEXT.sessionInUse);

    leave(socketId);
    player.socketId = socketId;
    player.connected = true;
    roomIdBySocketId.set(socketId, room.id);
    return { room, player };
  }

  function start(socketId) {
    const room = getRoomBySocketId(socketId);
    const player = room ? findPlayerBySocketId(room, socketId) : null;
    if (!room || !player) throw new RoomError('NOT_IN_ROOM', ERROR_TEXT.notInRoom);
    if (room.hostId !== player.id) {
      throw new RoomError('NOT_HOST', ERROR_TEXT.onlyHostCanStart);
    }
    if (room.status !== 'lobby') {
      throw new RoomError('GAME_ALREADY_STARTED', ERROR_TEXT.gameAlreadyStarted);
    }

    room.status = 'playing';
    room.game = createGameSession(room.players);
    return room;
  }

  function place(socketId, move) {
    const room = getRoomBySocketId(socketId);
    const player = room ? findPlayerBySocketId(room, socketId) : null;
    if (!room || !player || !room.game) throw new RoomError('GAME_NOT_FOUND', ERROR_TEXT.gameNotFound);

    const result = placeGamePiece(room.game, player.id, move, room.players);
    if (result.finished) room.status = 'finished';
    return room;
  }

  function expireTurn(roomId, expectedTurnEndsAt) {
    const room = getRoomById(roomId);
    if (!room?.game || room.status !== 'playing') return null;
    return expireGameTurn(room.game, room.players, expectedTurnEndsAt) ? room : null;
  }

  function getHostFinishedRoom(socketId) {
    const room = getRoomBySocketId(socketId);
    const player = room ? findPlayerBySocketId(room, socketId) : null;
    if (!room || !player) throw new RoomError('NOT_IN_ROOM', ERROR_TEXT.notInRoom);
    if (room.hostId !== player.id) {
      throw new RoomError('NOT_HOST', ERROR_TEXT.onlyHostCanOperate);
    }
    if (room.status !== 'finished') {
      throw new RoomError('GAME_NOT_FINISHED', ERROR_TEXT.gameNotFinished);
    }
    return room;
  }

  function rematch(socketId) {
    const room = getHostFinishedRoom(socketId);
    if (room.players.some((player) => !player.connected)) {
      throw new RoomError('PLAYER_DISCONNECTED', ERROR_TEXT.playerDisconnected);
    }
    room.status = 'playing';
    room.game = createGameSession(room.players);
    return room;
  }

  function returnToLobby(socketId) {
    const room = getHostFinishedRoom(socketId);
    room.status = 'lobby';
    room.game = null;
    return room;
  }

  return {
    create,
    join,
    resume,
    start,
    place,
    expireTurn,
    rematch,
    returnToLobby,
    leave,
    disconnect,
    removeDisconnected,
    getRoomById,
    getRoomBySocketId,
  };
}

export function serializeRoom(room) {
  return {
    serverNow: Date.now(),
    id: room.id,
    status: room.status,
    hostId: room.hostId,
    maxPlayers: MAX_PLAYERS,
    players: room.players.map(({ id, name, color, connected }) => ({ id, name, color, connected })),
    game: room.game,
  };
}
