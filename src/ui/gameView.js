import { BOARD_SIZE, CANVAS_SIZE, CELL_SIZE, TOUCH_DRAG_OFFSET_Y } from '../game/config.js';

export function createGameView(app, game) {
  app.innerHTML = `
    <div class="game-shell">
      <h1>ブロックパズル</h1>
      <div class="hud">
        <span>Score: <strong id="score">0</strong></span>
        <span>Clear: <strong id="clears">0</strong></span>
        <span>Hand: <strong id="stock">0</strong></span>
      </div>
      <div class="layout">
        <canvas id="board" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}"></canvas>
        <div class="side-panel">
          <div class="panel">
            <h2>手札</h2>
            <div id="hand" class="hand"></div>
          </div>
          <div class="panel controls">
            <p id="message"></p>
          </div>
        </div>
      </div>
    </div>
  `;

  const canvas = app.querySelector('#board');
  const ctx = canvas.getContext('2d');
  const scoreEl = app.querySelector('#score');
  const clearsEl = app.querySelector('#clears');
  const stockEl = app.querySelector('#stock');
  const handEl = app.querySelector('#hand');
  const messageEl = app.querySelector('#message');
  let piecePointerDownHandler = null;

  function buildMiniGrid(piece) {
    const size = 3;
    const grid = Array.from({ length: size }, () => Array(size).fill(0));
    const minX = Math.min(...piece.cells.map(([x]) => x));
    const minY = Math.min(...piece.cells.map(([, y]) => y));
    const maxX = Math.max(...piece.cells.map(([x]) => x));
    const maxY = Math.max(...piece.cells.map(([, y]) => y));
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const offsetX = Math.floor((size - width) / 2);
    const offsetY = Math.floor((size - height) / 2);

    piece.cells.forEach(([x, y]) => {
      const gridX = x - minX + offsetX;
      const gridY = y - minY + offsetY;
      if (gridX >= 0 && gridX < size && gridY >= 0 && gridY < size) {
        grid[gridY][gridX] = 1;
      }
    });

    return grid
      .map((row) => row.map((cell) => `<span class="mini-cell${cell ? ' active' : ''}"></span>`).join(''))
      .join('');
  }

  function renderHud() {
    const { state } = game;
    scoreEl.textContent = state.score;
    clearsEl.textContent = state.cleared;
    stockEl.textContent = state.hand.length;
    messageEl.textContent = state.message;
  }

  function renderHand() {
    handEl.innerHTML = '';
    game.state.hand.forEach((piece, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `piece-card${game.state.selectedIndex === index ? ' selected' : ''}`;
      button.innerHTML = `
        <span class="piece-name">${piece.name}</span>
        <div class="piece-preview">${buildMiniGrid(piece)}</div>
      `;
      if (piecePointerDownHandler) {
        button.addEventListener('pointerdown', (event) => piecePointerDownHandler(event, index));
      }
      handEl.appendChild(button);
    });
  }

  function renderBoard() {
    const { state } = game;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;
        ctx.fillStyle = '#111827';
        ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

        const cellColor = state.board[row][col];
        if (cellColor) {
          ctx.fillStyle = cellColor;
          ctx.fillRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6);
        }
      }
    }

    if (state.selectedIndex === null || !state.hoverCell) return;

    const piece = state.hand[state.selectedIndex];
    const canPreview = game.canPlaceSelected(state.hoverCell.x, state.hoverCell.y);
    piece.cells.forEach(([offsetX, offsetY]) => {
      const x = (state.hoverCell.x + offsetX) * CELL_SIZE;
      const y = (state.hoverCell.y + offsetY) * CELL_SIZE;
      ctx.fillStyle = canPreview ? 'rgba(255,255,255,0.25)' : 'rgba(248,113,113,0.35)';
      ctx.fillRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6);
    });
  }

  function render() {
    renderHud();
    renderHand();
    renderBoard();
  }

  function getCellFromPointer(event, useTouchDragOffset = false) {
    const rect = canvas.getBoundingClientRect();
    const isTouchPointer = event.pointerType === 'touch' || event.pointerType === 'pen';
    const offsetY = useTouchDragOffset && isTouchPointer ? TOUCH_DRAG_OFFSET_Y : 0;
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * BOARD_SIZE);
    const y = Math.floor(((event.clientY - offsetY - rect.top) / rect.height) * BOARD_SIZE);
    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return null;
    return { x, y };
  }

  function onPiecePointerDown(handler) {
    piecePointerDownHandler = handler;
  }

  return { canvas, render, renderBoard, getCellFromPointer, onPiecePointerDown };
}

