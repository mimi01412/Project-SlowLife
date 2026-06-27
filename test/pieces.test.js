import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandomPiece, rotateCells } from '../src/game/pieces.js';

function isConnected(cells) {
  const occupied = new Set(cells.map(([x, y]) => `${x},${y}`));
  const visited = new Set();
  const pending = [cells[0]];

  while (pending.length > 0) {
    const [x, y] = pending.pop();
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([offsetX, offsetY]) => {
      const next = [x + offsetX, y + offsetY];
      if (occupied.has(`${next[0]},${next[1]}`)) pending.push(next);
    });
  }

  return visited.size === cells.length;
}

test('creates connected pieces that fit inside a 3 by 3 grid', () => {
  for (let index = 0; index < 512; index += 1) {
    const values = [(index + 0.5) / 512, (index + 0.5) / 512, 0, 0.5];
    const piece = createRandomPiece(() => values.shift() ?? 0.5);

    assert.ok(piece.cells.length >= 1 && piece.cells.length <= 9);
    assert.ok(piece.cells.every(([x, y]) => x >= 0 && x < 3 && y >= 0 && y < 3));
    assert.equal(new Set(piece.cells.map(([x, y]) => `${x},${y}`)).size, piece.cells.length);
    assert.equal(isConnected(piece.cells), true);
  }
});

test('can generate both a single cell and a full 3 by 3 piece', () => {
  assert.equal(createRandomPiece(() => 0).cells.length, 1);
  assert.equal(createRandomPiece(() => 0.999999).cells.length, 9);
});

test('selects pieces of five cells or fewer 80 percent of the time', () => {
  const counts = Array(9).fill(0);
  for (let index = 0; index < 100; index += 1) {
    const values = [(index + 0.5) / 100, 0, 0, 0.5];
    const piece = createRandomPiece(() => values.shift() ?? 0.5);
    counts[piece.cells.length - 1] += 1;
  }

  assert.deepEqual(counts, [8, 12, 18, 22, 20, 10, 6, 3, 1]);
  assert.equal(counts.slice(0, 5).reduce((total, count) => total + count, 0), 80);
});

test('keeps every generated rotation normalized within a 3 by 3 grid', () => {
  for (let index = 0; index < 512; index += 1) {
    const values = [(index + 0.5) / 512, (index + 0.5) / 512, 0, 0.5];
    const piece = createRandomPiece(() => values.shift() ?? 0.5);

    for (let rotation = 0; rotation < 4; rotation += 1) {
      const cells = rotateCells(piece.cells, rotation);
      assert.equal(Math.min(...cells.map(([x]) => x)), 0);
      assert.equal(Math.min(...cells.map(([, y]) => y)), 0);
      assert.ok(cells.every(([x, y]) => x < 3 && y < 3));
    }
  }
});
