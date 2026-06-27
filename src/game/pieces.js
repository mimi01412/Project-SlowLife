const GRID_SIZE = 3;
const SIZE_WEIGHTS = [8, 12, 18, 22, 20, 10, 6, 3, 1];
const COLORS = [
  '#facc15',
  '#a78bfa',
  '#fb923c',
  '#60a5fa',
  '#4ade80',
  '#f87171',
  '#f472b6',
  '#2dd4bf',
  '#c084fc',
];

function normalizeCells(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort(([xA, yA], [xB, yB]) => yA - yB || xA - xB);
}

function cellsAreConnected(cells) {
  const remaining = new Set(cells.map(([x, y]) => `${x},${y}`));
  const pending = [cells[0]];
  remaining.delete(`${cells[0][0]},${cells[0][1]}`);

  while (pending.length > 0) {
    const [x, y] = pending.pop();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([offsetX, offsetY]) => {
      const key = `${x + offsetX},${y + offsetY}`;
      if (!remaining.delete(key)) return;
      pending.push([x + offsetX, y + offsetY]);
    });
  }

  return remaining.size === 0;
}

function createAllShapes() {
  const shapes = new Map();
  const cellCount = GRID_SIZE * GRID_SIZE;

  for (let mask = 1; mask < 2 ** cellCount; mask += 1) {
    const cells = [];
    for (let index = 0; index < cellCount; index += 1) {
      if ((mask & (1 << index)) === 0) continue;
      cells.push([index % GRID_SIZE, Math.floor(index / GRID_SIZE)]);
    }
    if (!cellsAreConnected(cells)) continue;

    const normalizedCells = normalizeCells(cells);
    const key = normalizedCells.map(([x, y]) => `${x},${y}`).join('|');
    if (!shapes.has(key)) shapes.set(key, normalizedCells);
  }

  return [...shapes.values()];
}

let shapes = null;
let shapesBySize = null;

function getShapes() {
  if (!shapes) shapes = createAllShapes();
  return shapes;
}

function getShapesBySize() {
  if (!shapesBySize) {
    shapesBySize = Array.from({ length: GRID_SIZE * GRID_SIZE }, () => []);
    getShapes().forEach((cells) => shapesBySize[cells.length - 1].push(cells));
  }
  return shapesBySize;
}

function selectSizeIndex(randomValue) {
  const totalWeight = SIZE_WEIGHTS.reduce((total, weight) => total + weight, 0);
  let target = randomValue * totalWeight;

  for (let index = 0; index < SIZE_WEIGHTS.length; index += 1) {
    target -= SIZE_WEIGHTS[index];
    if (target < 0) return index;
  }
  return SIZE_WEIGHTS.length - 1;
}

function createPiece(cells, random) {
  const color = COLORS[Math.floor(random() * COLORS.length)];
  return {
    id: `piece-${random().toString(36).slice(2, 10)}`,
    name: `${cells.length}マス`,
    color,
    cells: cells.map(([x, y]) => [x, y]),
  };
}

export function rotateCells(cells, rotationCount = 1) {
  let rotatedCells = cells.map(([x, y]) => [x, y]);
  const turns = ((rotationCount % 4) + 4) % 4;

  for (let turn = 0; turn < turns; turn += 1) {
    rotatedCells = normalizeCells(rotatedCells.map(([x, y]) => [y, -x]));
  }

  return rotatedCells;
}

export function createRandomPiece(random = Math.random) {
  const availableSizes = getShapesBySize();
  const shapesOfSize = availableSizes[selectSizeIndex(random())];
  const cells = shapesOfSize[Math.floor(random() * shapesOfSize.length)];
  return createPiece(cells, random);
}
