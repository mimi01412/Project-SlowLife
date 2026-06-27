import { canPlacePiece } from '../game/board.js';
import { BOARD_SIZE, CANVAS_SIZE, CELL_SIZE, TOUCH_DRAG_OFFSET_Y } from '../game/config.js';
import { rotateCells } from '../game/pieces.js';
import { UI_TEXT } from '../content/text.js';

let openParticipantsRoomId = null;

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}

function buildMiniGrid(piece) {
  const size = 3;
  const grid = Array.from({ length: size }, () => Array(size).fill(false));
  const minX = Math.min(...piece.cells.map(([x]) => x));
  const minY = Math.min(...piece.cells.map(([, y]) => y));

  piece.cells.forEach(([x, y]) => {
    const gridX = x - minX;
    const gridY = y - minY;
    if (gridX < size && gridY < size) grid[gridY][gridX] = true;
  });

  return grid
    .flatMap((row) => row.map((cell) => `<span class="mini-cell${cell ? ' active' : ''}"></span>`))
    .join('');
}

function drawBoard(canvas, board, preview = null) {
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const boardGradient = context.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  boardGradient.addColorStop(0, '#24103f');
  boardGradient.addColorStop(0.55, '#140a2a');
  boardGradient.addColorStop(1, '#0c071a');
  context.fillStyle = boardGradient;
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const x = column * CELL_SIZE;
      const y = row * CELL_SIZE;
      context.fillStyle = 'rgba(42, 21, 70, 0.72)';
      context.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      context.strokeStyle = 'rgba(211, 164, 255, 0.18)';
      context.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

      if (board[row][column]) {
        context.shadowColor = board[row][column];
        context.shadowBlur = 10;
        context.fillStyle = board[row][column];
        context.fillRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6);
        context.fillStyle = 'rgba(255,255,255,0.22)';
        context.fillRect(x + 5, y + 5, CELL_SIZE - 10, 3);
        context.shadowBlur = 0;
      }
    }
  }

  if (!preview) return;
  preview.piece.cells.forEach(([offsetX, offsetY]) => {
    const x = (preview.x + offsetX) * CELL_SIZE;
    const y = (preview.y + offsetY) * CELL_SIZE;
    context.fillStyle = preview.canPlace ? 'rgba(255,183,223,0.42)' : 'rgba(251,113,133,0.46)';
    context.fillRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6);
  });
}

function getCellFromPointer(canvas, event, useTouchOffset = false) {
  const rect = canvas.getBoundingClientRect();
  const isTouch = event.pointerType === 'touch' || event.pointerType === 'pen';
  const offsetY = useTouchOffset && isTouch ? TOUCH_DRAG_OFFSET_Y : 0;
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * BOARD_SIZE);
  const y = Math.floor(((event.clientY - offsetY - rect.top) / rect.height) * BOARD_SIZE);
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE ? { x, y } : null;
}

export function renderGameView(root, { room, selfId, onLeave, onPlace }) {
  const { game } = room;
  const self = room.players.find((player) => player.id === selfId);
  const currentPlayer = room.players.find((player) => player.id === game.currentPlayerId);
  const isMyTurn = room.status === 'playing' && game.currentPlayerId === selfId && self?.connected;
  const hand = game.hand
    .map(
      (piece) => `
        <button class="piece-card" data-piece-id="${escapeHtml(piece.id)}" type="button" ${isMyTurn ? '' : 'disabled'}>
          <span class="piece-name">${escapeHtml(piece.name)}</span>
          <span class="piece-preview" style="--piece-color: ${piece.color}">${buildMiniGrid(piece)}</span>
        </button>
      `,
    )
    .join('');
  const players = room.players
    .map(
      (player) => `
        <li class="game-player${player.id === game.currentPlayerId ? ' is-current' : ''}${player.connected ? '' : ' is-offline'}">
          <span>${escapeHtml(player.name)}</span>
          ${player.id === selfId ? `<small>${UI_TEXT.common.self}</small>` : ''}
          ${player.connected ? '' : `<small>${UI_TEXT.game.reconnecting}</small>`}
          ${player.id === game.currentPlayerId ? `<strong>${UI_TEXT.game.turnBadge}</strong>` : ''}
        </li>
      `,
    )
    .join('');

  root.innerHTML = `
    <main class="game-page">
      <section class="game-shell online-game-shell">
        <header class="game-header">
          <div>
            <p class="eyebrow">${UI_TEXT.game.roomLabel} ${escapeHtml(room.id)}</p>
            <h1>${UI_TEXT.common.appName}</h1>
          </div>
          <div class="game-header-actions">
            <button id="open-players" class="participants-icon-button" type="button" aria-haspopup="dialog" aria-label="${UI_TEXT.game.showPlayers}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <strong>${room.players.length}</strong>
            </button>
            <button id="leave-game" class="text-button" type="button">${UI_TEXT.common.leave}</button>
          </div>
        </header>

        <div class="hud">
          <span>${UI_TEXT.game.score} <strong>${game.score}</strong></span>
          <span>${UI_TEXT.game.clear} <strong>${game.cleared}</strong></span>
          <span>${UI_TEXT.game.turn} <strong>${game.turnNumber}</strong></span>
        </div>

        <div class="turn-banner${isMyTurn ? ' is-mine' : ''}${game.finished ? ' is-finished' : ''}">
          <span>${
            game.finished
              ? UI_TEXT.game.finished
              : isMyTurn
                ? UI_TEXT.game.yourTurn
                : UI_TEXT.game.playerTurn(escapeHtml(currentPlayer?.name ?? ''))
          }</span>
          <small id="game-message">${escapeHtml(game.message)}</small>
        </div>

        <div class="layout">
          <canvas id="board" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" aria-label="${UI_TEXT.game.boardLabel}"></canvas>
          <aside class="side-panel">
            <section class="panel">
              <h2>${UI_TEXT.game.handTitle}</h2>
              <div class="hand">${hand}</div>
            </section>
          </aside>
        </div>
      </section>
      <dialog id="players-dialog" class="players-dialog" aria-labelledby="players-dialog-title">
        <header>
          <div>
            <p>${UI_TEXT.game.membersCategory}</p>
            <h2 id="players-dialog-title">${UI_TEXT.common.players}</h2>
          </div>
          <button id="close-players" type="button" aria-label="${UI_TEXT.common.close}">×</button>
        </header>
        <ul>${players}</ul>
      </dialog>
    </main>
  `;

  const canvas = root.querySelector('#board');
  const message = root.querySelector('#game-message');
  let selectedPieceId = null;
  let rotation = 0;
  let hoverCell = null;
  let dragPointerId = null;
  let pending = false;
  let disposed = false;

  function getSelectedPiece() {
    const piece = game.hand.find((candidate) => candidate.id === selectedPieceId);
    return piece ? { ...piece, cells: rotateCells(piece.cells, rotation) } : null;
  }

  function renderInteraction() {
    root.querySelectorAll('[data-piece-id]').forEach((button) => {
      button.classList.toggle('selected', button.dataset.pieceId === selectedPieceId);
    });

    const piece = getSelectedPiece();
    const preview = piece && hoverCell
      ? {
          piece,
          ...hoverCell,
          canPlace: canPlacePiece(game.board, piece, hoverCell.x, hoverCell.y),
        }
      : null;
    drawBoard(canvas, game.board, preview);
  }

  function rotateSelection() {
    if (!selectedPieceId || pending) return;
    rotation = (rotation + 1) % 4;
    message.textContent = UI_TEXT.game.rotated;
    renderInteraction();
  }

  const onPointerMove = (event) => {
    if (event.pointerId !== dragPointerId || pending) return;
    hoverCell = getCellFromPointer(canvas, event, true);
    renderInteraction();
  };

  const onPointerUp = async (event) => {
    if (event.pointerId !== dragPointerId || pending) return;
    const cell = getCellFromPointer(canvas, event, true);
    dragPointerId = null;
    hoverCell = null;

    if (!cell || !selectedPieceId) {
      selectedPieceId = null;
      message.textContent = UI_TEXT.game.placementCancelled;
      return renderInteraction();
    }

    const piece = getSelectedPiece();
    if (!canPlacePiece(game.board, piece, cell.x, cell.y)) {
      selectedPieceId = null;
      message.textContent = UI_TEXT.game.cannotPlace;
      return renderInteraction();
    }

    pending = true;
    message.textContent = UI_TEXT.game.checkingPlacement;
    try {
      await onPlace({ pieceId: selectedPieceId, x: cell.x, y: cell.y, rotation });
    } catch (error) {
      if (disposed) return;
      pending = false;
      selectedPieceId = null;
      message.textContent = error.message;
      renderInteraction();
    }
  };

  const onPointerCancel = (event) => {
    if (event.pointerId !== dragPointerId) return;
    dragPointerId = null;
    selectedPieceId = null;
    hoverCell = null;
    message.textContent = UI_TEXT.game.placementCancelled;
    renderInteraction();
  };

  const onSecondPointer = (event) => {
    if (dragPointerId === null || event.pointerId === dragPointerId) return;
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    event.preventDefault();
    rotateSelection();
  };

  const onKeyDown = (event) => {
    if ((event.key === ' ' || event.key === 'Spacebar') && dragPointerId !== null) {
      event.preventDefault();
      rotateSelection();
    }
  };

  root.querySelectorAll('[data-piece-id]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      if (!isMyTurn || pending || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      selectedPieceId = button.dataset.pieceId;
      rotation = 0;
      hoverCell = null;
      dragPointerId = event.pointerId;
      message.textContent = UI_TEXT.game.dragHelp;
      renderInteraction();
    });
  });

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('pointerdown', onSecondPointer);
  window.addEventListener('keydown', onKeyDown);
  const playersDialog = root.querySelector('#players-dialog');
  root.querySelector('#open-players').addEventListener('click', () => {
    openParticipantsRoomId = room.id;
    playersDialog.showModal();
  });
  root.querySelector('#close-players').addEventListener('click', () => playersDialog.close());
  playersDialog.addEventListener('click', (event) => {
    if (event.target === playersDialog) playersDialog.close();
  });
  playersDialog.addEventListener('close', () => {
    openParticipantsRoomId = null;
  });
  root.querySelector('#leave-game').addEventListener('click', () => {
    openParticipantsRoomId = null;
    onLeave();
  });
  if (openParticipantsRoomId === room.id) playersDialog.showModal();
  drawBoard(canvas, game.board);

  return () => {
    disposed = true;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('pointerdown', onSecondPointer);
    window.removeEventListener('keydown', onKeyDown);
  };
}
