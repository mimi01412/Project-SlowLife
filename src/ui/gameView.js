import { canPlacePiece } from '../game/board.js';
import { BOARD_SIZE, CANVAS_SIZE, CELL_SIZE, TOUCH_DRAG_OFFSET_Y } from '../game/config.js';
import { rotateCells } from '../game/pieces.js';

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
  context.fillStyle = '#020617';
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const x = column * CELL_SIZE;
      const y = row * CELL_SIZE;
      context.fillStyle = '#111827';
      context.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      context.strokeStyle = '#334155';
      context.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

      if (board[row][column]) {
        context.fillStyle = board[row][column];
        context.fillRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6);
      }
    }
  }

  if (!preview) return;
  preview.piece.cells.forEach(([offsetX, offsetY]) => {
    const x = (preview.x + offsetX) * CELL_SIZE;
    const y = (preview.y + offsetY) * CELL_SIZE;
    context.fillStyle = preview.canPlace ? 'rgba(255,255,255,0.28)' : 'rgba(248,113,113,0.38)';
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
          ${player.id === selfId ? '<small>あなた</small>' : ''}
          ${player.connected ? '' : '<small>再接続待ち</small>'}
          ${player.id === game.currentPlayerId ? '<strong>TURN</strong>' : ''}
        </li>
      `,
    )
    .join('');

  root.innerHTML = `
    <main class="game-page">
      <section class="game-shell online-game-shell">
        <header class="game-header">
          <div>
            <p class="eyebrow">ROOM ${escapeHtml(room.id)}</p>
            <h1>Slow Life Blocks</h1>
          </div>
          <div class="game-header-actions">
            <button id="open-players" class="participants-icon-button" type="button" aria-haspopup="dialog" aria-label="参加メンバーを表示">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <strong>${room.players.length}</strong>
            </button>
            <button id="leave-game" class="text-button" type="button">退出する</button>
          </div>
        </header>

        <div class="hud">
          <span>Score <strong>${game.score}</strong></span>
          <span>Clear <strong>${game.cleared}</strong></span>
          <span>Turn <strong>${game.turnNumber}</strong></span>
        </div>

        <div class="turn-banner${isMyTurn ? ' is-mine' : ''}${game.finished ? ' is-finished' : ''}">
          <span>${
            game.finished
              ? 'ゲーム終了'
              : isMyTurn
                ? 'あなたのターンです'
                : `${escapeHtml(currentPlayer?.name ?? '')}さんのターンです`
          }</span>
          <small id="game-message">${escapeHtml(game.message)}</small>
        </div>

        <div class="layout">
          <canvas id="board" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" aria-label="共有ゲーム盤面"></canvas>
          <aside class="side-panel">
            <section class="panel">
              <h2>共有の手札</h2>
              <div class="hand">${hand}</div>
            </section>
          </aside>
        </div>
      </section>
      <dialog id="players-dialog" class="players-dialog" aria-labelledby="players-dialog-title">
        <header>
          <div>
            <p>ROOM MEMBERS</p>
            <h2 id="players-dialog-title">参加メンバー</h2>
          </div>
          <button id="close-players" type="button" aria-label="閉じる">×</button>
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
    message.textContent = 'ピースを回転しました。';
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
      message.textContent = '配置をキャンセルしました。';
      return renderInteraction();
    }

    const piece = getSelectedPiece();
    if (!canPlacePiece(game.board, piece, cell.x, cell.y)) {
      selectedPieceId = null;
      message.textContent = 'その位置には配置できません。';
      return renderInteraction();
    }

    pending = true;
    message.textContent = '配置を確認しています…';
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
    message.textContent = '配置をキャンセルしました。';
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
      message.textContent = '盤面へドラッグしてください。スペースキーまたは2本目の指で回転できます。';
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
