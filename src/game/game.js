import { canPlacePiece, clearLines, createEmptyBoard, placePiece } from './board.js';
import { HAND_SIZE } from './config.js';
import { createRandomPiece, rotatePiece } from './pieces.js';

const INITIAL_MESSAGE = '手札をつかんでボードへドラッグしてください。スマホは画面タップで回転です。';
const ROTATED_MESSAGE = '回転しました。配置位置を選択してください。';

export function createGame() {
  const state = {
    board: createEmptyBoard(),
    hand: [],
    selectedIndex: null,
    hoverCell: null,
    isDragging: false,
    dragPointerId: null,
    score: 0,
    cleared: 0,
    message: INITIAL_MESSAGE,
  };

  function fillHand() {
    while (state.hand.length < HAND_SIZE) {
      state.hand.push(createRandomPiece());
    }
  }

  function getSelectedPiece() {
    return state.selectedIndex === null ? null : state.hand[state.selectedIndex];
  }

  function startDrag(index, pointerId, pointerType) {
    state.selectedIndex = index;
    state.isDragging = true;
    state.dragPointerId = pointerId;
    state.hoverCell = null;
    state.message =
      pointerType === 'touch' || pointerType === 'pen'
        ? '手札をボードへドラッグし、離して配置します。ドラッグ中は2本目のタップで回転できます。'
        : '手札をボードへドラッグし、離して配置します。スペースで回転できます。';
  }

  function rotateSelected() {
    const piece = getSelectedPiece();
    if (!piece) return false;
    rotatePiece(piece);
    state.message = ROTATED_MESSAGE;
    return true;
  }

  function canPlaceSelected(x, y) {
    const piece = getSelectedPiece();
    return piece ? canPlacePiece(state.board, piece, x, y) : false;
  }

  function placeSelected(x, y) {
    const piece = getSelectedPiece();
    if (!piece || !canPlacePiece(state.board, piece, x, y)) return false;

    placePiece(state.board, piece, x, y);
    const cleared = clearLines(state.board);
    if (cleared > 0) {
      state.cleared += cleared;
      state.score += cleared * 100;
      state.message = `${cleared}ライン消去！`;
    } else {
      state.message = '配置しました。';
    }

    state.hand.splice(state.selectedIndex, 1);
    state.selectedIndex = null;
    state.hoverCell = null;
    fillHand();
    return true;
  }

  function setHoverCell(cell) {
    state.hoverCell = cell;
  }

  function finishDrag() {
    state.isDragging = false;
    state.dragPointerId = null;
  }

  function cancelDrag(message = '配置をキャンセルしました。再度手札をつかんでください。') {
    finishDrag();
    state.selectedIndex = null;
    state.hoverCell = null;
    state.message = message;
  }

  function reset() {
    state.board = createEmptyBoard();
    state.hand = [];
    state.selectedIndex = null;
    state.hoverCell = null;
    state.isDragging = false;
    state.dragPointerId = null;
    state.score = 0;
    state.cleared = 0;
    state.message = '盤面をリセットしました。';
    fillHand();
  }

  fillHand();

  return {
    state,
    startDrag,
    rotateSelected,
    canPlaceSelected,
    placeSelected,
    setHoverCell,
    finishDrag,
    cancelDrag,
    reset,
  };
}

