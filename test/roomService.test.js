import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomService, RoomError } from '../server/room/roomService.js';

test('creates a room and assigns its creator as host', () => {
  const service = createRoomService();
  const room = service.create({ socketId: 'alice-id', name: 'Alice', roomId: 'slow-life' });

  assert.equal(room.id, 'slow-life');
  assert.equal(room.hostId, 'alice-id');
  assert.deepEqual(room.players, [{ id: 'alice-id', name: 'Alice' }]);
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
  service.create({ socketId: 'host-id', name: 'Host', roomId: 'handover' });
  service.join({ socketId: 'guest-id', name: 'Guest', roomId: 'handover' });

  const afterHostLeaves = service.leave('host-id');
  assert.equal(afterHostLeaves.room.hostId, 'guest-id');

  const afterGuestLeaves = service.leave('guest-id');
  assert.equal(afterGuestLeaves.room, null);
  assert.equal(service.getRoomBySocketId('guest-id'), null);
});
