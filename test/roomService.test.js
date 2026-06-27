import test from 'node:test';
import assert from 'node:assert/strict';
import { canPlacePiece } from '../src/game/board.js';
import { BOARD_SIZE } from '../src/game/config.js';
import { rotateCells } from '../src/game/pieces.js';
import { createRoomService, RoomError } from '../server/room/roomService.js';

test('creates a room and assigns its creator as host', () => {
  const service = createRoomService();
  const { room, player } = service.create({ socketId: 'alice-socket', name: 'Alice', roomId: 'slow-life' });

  assert.equal(room.id, 'slow-life');
  assert.equal(room.hostId, player.id);
  assert.equal(room.players[0].name, 'Alice');
  assert.equal(room.players[0].connected, true);
  assert.ok(player.reconnectToken);
});

test('joins an existing room up to eight players', () => {
  const service = createRoomService();
  service.create({ socketId: 'player-1', name: 'Player 1', roomId: 'friends' });

  for (let index = 2; index <= 8; index += 1) {
    service.join({ socketId: `player-${index}`, name: `Player ${index}`, roomId: 'friends' });
  }

  assert.equal(service.getRoomBySocketId('player-8').players.length, 8);
  assert.throws(
    () => service.join({ socketId: 'player-9', name: 'Player 9', roomId: 'friends' }),
    (error) => error instanceof RoomError && error.code === 'ROOM_FULL',
  );
});

test('rejects duplicate room ids and duplicate player names', () => {
  const service = createRoomService();
  service.create({ socketId: 'alice-id', name: 'Alice', roomId: 'same-room' });

  assert.throws(
    () => service.create({ socketId: 'other-id', name: 'Other', roomId: 'same-room' }),
    (error) => error.code === 'ROOM_EXISTS',
  );
  assert.throws(
    () => service.join({ socketId: 'alice-2', name: 'alice', roomId: 'same-room' }),
    (error) => error.code === 'NAME_TAKEN',
  );
});

test('transfers host and deletes an empty room when players leave', () => {
  const service = createRoomService();
  service.create({ socketId: 'host-socket', name: 'Host', roomId: 'handover' });
  const { player: guest } = service.join({ socketId: 'guest-socket', name: 'Guest', roomId: 'handover' });

  const afterHostLeaves = service.leave('host-socket');
  assert.equal(afterHostLeaves.room.hostId, guest.id);

  const afterGuestLeaves = service.leave('guest-socket');
  assert.equal(afterGuestLeaves.room, null);
  assert.equal(service.getRoomBySocketId('guest-socket'), null);
});

test('only the host can start and the server creates a shared game state', () => {
  const service = createRoomService();
  const { player: host } = service.create({ socketId: 'host-socket', name: 'Host', roomId: 'start-room' });
  service.join({ socketId: 'guest-socket', name: 'Guest', roomId: 'start-room' });

  assert.throws(() => service.start('guest-socket'), (error) => error.code === 'NOT_HOST');

  const room = service.start('host-socket');
  assert.equal(room.status, 'playing');
  assert.equal(room.game.currentPlayerId, host.id);
  assert.equal(room.game.hand.length, 3);
  assert.equal(room.game.board.length, 16);

  assert.throws(
    () => service.join({ socketId: 'late-id', name: 'Late', roomId: 'start-room' }),
    (error) => error.code === 'GAME_ALREADY_STARTED',
  );
});

test('places a piece on the server and advances exactly one turn', () => {
  const service = createRoomService();
  const { player: host } = service.create({ socketId: 'host-socket', name: 'Host', roomId: 'turn-room' });
  const { player: guest } = service.join({ socketId: 'guest-socket', name: 'Guest', roomId: 'turn-room' });
  const room = service.start('host-socket');
  const piece = room.game.hand[0];

  let move = null;
  for (let rotation = 0; rotation < 4 && !move; rotation += 1) {
    const candidate = { ...piece, cells: rotateCells(piece.cells, rotation) };
    for (let y = 0; y < BOARD_SIZE && !move; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        if (canPlacePiece(room.game.board, candidate, x, y)) {
          move = { pieceId: piece.id, x, y, rotation };
          break;
        }
      }
    }
  }

  assert.throws(() => service.place('guest-socket', move), (error) => error.code === 'NOT_YOUR_TURN');
  service.place('host-socket', move);
  assert.equal(room.game.currentPlayerId, guest.id);
  assert.equal(room.game.turnNumber, 2);
  assert.equal(room.game.hand.length, 3);
  assert.notEqual(room.game.hand[0].id, piece.id);
  assert.equal(room.game.turnOrder[0], host.id);
});

test('resumes a disconnected player with a stable player id', () => {
  const service = createRoomService();
  const { player } = service.create({ socketId: 'old-socket', name: 'Alice', roomId: 'resume-room' });
  service.disconnect('old-socket');

  const resumed = service.resume({
    socketId: 'new-socket',
    roomId: 'resume-room',
    reconnectToken: player.reconnectToken,
  });

  assert.equal(resumed.player.id, player.id);
  assert.equal(resumed.player.connected, true);
  assert.equal(service.getRoomBySocketId('new-socket'), resumed.room);
});
