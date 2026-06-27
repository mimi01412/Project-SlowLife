import test from 'node:test';
import assert from 'node:assert/strict';
import { clearLines, createEmptyBoard, getCompletedLines } from '../src/game/board.js';
import { BOARD_SIZE } from '../src/game/config.js';

test('reports the exact rows and columns cleared from the board', () => {
  const board = createEmptyBoard();
  const row = 2;
  const column = 7;

  for (let index = 0; index < BOARD_SIZE; index += 1) {
    board[row][index] = '#fff';
    board[index][column] = '#fff';
  }

  assert.deepEqual(getCompletedLines(board), { rows: [row], columns: [column] });
  assert.equal(clearLines(board), 2);
  assert.ok(board[row].every((cell) => cell === null));
  assert.ok(board.every((boardRow) => boardRow[column] === null));
});
