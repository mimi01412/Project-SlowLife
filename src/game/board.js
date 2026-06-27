import { BOARD_SIZE } from './config.js';

export function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

export function canPlacePiece(board, piece, x, y) {
  return piece.cells.every(([offsetX, offsetY]) => {
    const targetX = x + offsetX;
    const targetY = y + offsetY;
    return (
      targetX >= 0 &&
      targetX < BOARD_SIZE &&
      targetY >= 0 &&
      targetY < BOARD_SIZE &&
      board[targetY][targetX] === null
    );
  });
}

export function placePiece(board, piece, x, y) {
  piece.cells.forEach(([offsetX, offsetY]) => {
    board[y + offsetY][x + offsetX] = piece.color;
  });
}

export function clearLines(board) {
  const rowsToClear = [];
  const colsToClear = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    if (board[row].every(Boolean)) rowsToClear.push(row);
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    if (board.every((row) => row[col])) colsToClear.push(col);
  }

  rowsToClear.forEach((row) => {
    board[row] = Array(BOARD_SIZE).fill(null);
  });
  colsToClear.forEach((col) => {
    board.forEach((row) => {
      row[col] = null;
    });
  });

  return rowsToClear.length + colsToClear.length;
}

