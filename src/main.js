import './style.css';

const BOARD_SIZE = 16;
const CELL_SIZE = 40;
const CANVAS_SIZE = BOARD_SIZE * CELL_SIZE;

const SHAPES = [
  { name: 'O', color: '#facc15', cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { name: 'T', color: '#a78bfa', cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  { name: 'L', color: '#fb923c', cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { name: 'J', color: '#60a5fa', cells: [[1, 0], [1, 1], [1, 2], [0, 2]] },
  { name: 'S', color: '#4ade80', cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { name: 'Z', color: '#f87171', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
];

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="game-shell">
    <h1>Block Puzzle</h1>
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
          <p id="message">手札を選んで盤面に置きましょう。</p>
          <button id="rotate" type="button">回転</button>
          <button id="reset" type="button">リセット</button>
        </div>
      </div>
    </div>
  </div>
`;

const canvas = document.querySelector('#board');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const clearsEl = document.querySelector('#clears');
const stockEl = document.querySelector('#stock');
const handEl = document.querySelector('#hand');
const messageEl = document.querySelector('#message');
const rotateButton = document.querySelector('#rotate');
const resetButton = document.querySelector('#reset');

const state = {
  board: createEmptyBoard(),
  hand: [],
  selectedIndex: null,
  hoverCell: null,
  score: 0,
  cleared: 0,
  message: '手札を選んで盤面に置きましょう。',
};

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function createPiece(template) {
  return {
    id: `${template.name}-${Math.random().toString(36).slice(2, 8)}`,
    name: template.name,
    color: template.color,
    cells: template.cells.map(([x, y]) => [x, y]),
  };
}

function randomPiece() {
  const template = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return createPiece(template);
}

function normalizeCells(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

function rotatePiece(piece) {
  piece.cells = normalizeCells(piece.cells.map(([x, y]) => [y, -x]));
}

function fillHand() {
  while (state.hand.length < 3) {
    state.hand.push(randomPiece());
  }
}

function updateHud() {
  scoreEl.textContent = state.score;
  clearsEl.textContent = state.cleared;
  stockEl.textContent = state.hand.length;
  messageEl.textContent = state.message;
}

function renderHand() {
  handEl.innerHTML = '';
  state.hand.forEach((piece, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `piece-card${state.selectedIndex === index ? ' selected' : ''}`;
    button.innerHTML = `
      <span class="piece-name">${piece.name}</span>
      <div class="piece-preview">${buildMiniGrid(piece)}</div>
    `;
    button.addEventListener('click', () => {
      state.selectedIndex = index;
      state.message = '配置先をクリックしてください。';
      updateHud();
      renderHand();
      renderBoard();
    });
    handEl.appendChild(button);
  });
}

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
  return grid.map((row) => row.map((cell) => `<span class="mini-cell${cell ? ' active' : ''}"></span>`).join('')).join('');
}

function canPlacePiece(piece, x, y) {
  return piece.cells.every(([offsetX, offsetY]) => {
    const targetX = x + offsetX;
    const targetY = y + offsetY;
    return targetX >= 0 && targetX < BOARD_SIZE && targetY >= 0 && targetY < BOARD_SIZE && state.board[targetY][targetX] === null;
  });
}

function placePiece(piece, x, y) {
  piece.cells.forEach(([offsetX, offsetY]) => {
    state.board[y + offsetY][x + offsetX] = piece.color;
  });
}

function clearLines() {
  const rowsToClear = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    if (state.board[row].every(Boolean)) rowsToClear.push(row);
  }

  const colsToClear = [];
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    if (state.board.every((row) => row[col])) colsToClear.push(col);
  }

  if (rowsToClear.length === 0 && colsToClear.length === 0) {
    return 0;
  }

  rowsToClear.forEach((row) => {
    state.board[row] = Array(BOARD_SIZE).fill(null);
  });
  colsToClear.forEach((col) => {
    state.board.forEach((row) => {
      row[col] = null;
    });
  });

  return rowsToClear.length + colsToClear.length;
}

function handlePlacement(x, y) {
  if (state.selectedIndex === null) {
    state.message = '先に手札を選んでください。';
    updateHud();
    renderBoard();
    return;
  }

  const piece = state.hand[state.selectedIndex];
  if (!canPlacePiece(piece, x, y)) {
    state.message = 'そこには置けません。';
    updateHud();
    renderBoard();
    return;
  }

  placePiece(piece, x, y);
  const cleared = clearLines();
  if (cleared > 0) {
    state.cleared += cleared;
    state.score += cleared * 100;
    state.message = `${cleared}ライン消去！`;
  } else {
    state.message = '配置しました。';
  }

  state.hand.splice(state.selectedIndex, 1);
  fillHand();
  state.selectedIndex = null;
  updateHud();
  renderHand();
  renderBoard();
}

function renderBoard() {
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

  if (state.selectedIndex !== null && state.hoverCell) {
    const piece = state.hand[state.selectedIndex];
    const canPreview = canPlacePiece(piece, state.hoverCell.x, state.hoverCell.y);
    piece.cells.forEach(([offsetX, offsetY]) => {
      const px = (state.hoverCell.x + offsetX) * CELL_SIZE;
      const py = (state.hoverCell.y + offsetY) * CELL_SIZE;
      ctx.fillStyle = canPreview ? 'rgba(255,255,255,0.25)' : 'rgba(248,113,113,0.35)';
      ctx.fillRect(px + 3, py + 3, CELL_SIZE - 6, CELL_SIZE - 6);
    });
  }
}

function getCellFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * BOARD_SIZE);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * BOARD_SIZE);
  if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return null;
  return { x, y };
}

canvas.addEventListener('pointermove', (event) => {
  state.hoverCell = getCellFromPointer(event);
  renderBoard();
});

canvas.addEventListener('pointerleave', () => {
  state.hoverCell = null;
  renderBoard();
});

canvas.addEventListener('pointerdown', (event) => {
  const cell = getCellFromPointer(event);
  if (!cell) return;
  event.preventDefault();
  handlePlacement(cell.x, cell.y);
});

rotateButton.addEventListener('click', () => {
  if (state.selectedIndex === null) {
    state.message = '先に手札を選んでください。';
    updateHud();
    return;
  }
  rotatePiece(state.hand[state.selectedIndex]);
  state.message = '回転しました。';
  updateHud();
  renderHand();
  renderBoard();
});

resetButton.addEventListener('click', () => {
  state.board = createEmptyBoard();
  state.hand = [];
  state.selectedIndex = null;
  state.hoverCell = null;
  state.score = 0;
  state.cleared = 0;
  state.message = '盤面をリセットしました。';
  fillHand();
  updateHud();
  renderHand();
  renderBoard();
});

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    rotateButton.click();
  }
});

fillHand();
updateHud();
renderHand();
renderBoard();
