const SHAPES = [
  { name: 'O', color: '#facc15', cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { name: 'T', color: '#a78bfa', cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  { name: 'L', color: '#fb923c', cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { name: 'J', color: '#60a5fa', cells: [[1, 0], [1, 1], [1, 2], [0, 2]] },
  { name: 'S', color: '#4ade80', cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { name: 'Z', color: '#f87171', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
];

function createPiece(template) {
  return {
    id: `${template.name}-${Math.random().toString(36).slice(2, 8)}`,
    name: template.name,
    color: template.color,
    cells: template.cells.map(([x, y]) => [x, y]),
  };
}

function normalizeCells(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

export function rotateCells(cells, rotationCount = 1) {
  let rotatedCells = cells.map(([x, y]) => [x, y]);
  const turns = ((rotationCount % 4) + 4) % 4;

  for (let turn = 0; turn < turns; turn += 1) {
    rotatedCells = normalizeCells(rotatedCells.map(([x, y]) => [y, -x]));
  }

  return rotatedCells;
}

export function createRandomPiece() {
  const template = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return createPiece(template);
}

export function rotatePiece(piece) {
  piece.cells = rotateCells(piece.cells);
}

