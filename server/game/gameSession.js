import { canPlacePiece, clearLines, createEmptyBoard, getCompletedLines, placePiece } from '../../src/game/board.js';
import { BOARD_SIZE, HAND_SIZE, TURN_DURATION_MS } from '../../src/game/config.js';
import { createRandomPiece, rotateCells } from '../../src/game/pieces.js';
import { ERROR_TEXT, GAME_TEXT } from '../../src/content/text.js';

export class GameError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GameError';
    this.code = code;
  }
}

function fillHand(game) {
  while (game.hand.length < HAND_SIZE) game.hand.push(createRandomPiece());
}

function findPlayer(players, playerId) {
  return players.find((player) => player.id === playerId);
}

function setCurrentPlayer(game, players, now = Date.now()) {
  game.currentPlayerId = game.turnOrder[game.turnIndex] ?? null;
  const currentPlayer = findPlayer(players, game.currentPlayerId);
  game.message = currentPlayer ? GAME_TEXT.playerTurn(currentPlayer.name) : GAME_TEXT.noPlayers;
  game.turnEndsAt = currentPlayer ? now + TURN_DURATION_MS : null;
}

function advanceTurn(game, players, now = Date.now()) {
  if (game.turnOrder.length === 0) return setCurrentPlayer(game, players, now);
  game.turnIndex = (game.turnIndex + 1) % game.turnOrder.length;
  game.turnNumber += 1;
  setCurrentPlayer(game, players, now);
}

function canPlaceAnyPiece(game) {
  return game.hand.some((piece) => {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const candidate = { ...piece, cells: rotateCells(piece.cells, rotation) };
      for (let y = 0; y < BOARD_SIZE; y += 1) {
        for (let x = 0; x < BOARD_SIZE; x += 1) {
          if (canPlacePiece(game.board, candidate, x, y)) return true;
        }
      }
    }
    return false;
  });
}

export function createGameSession(players) {
  const game = {
    board: createEmptyBoard(),
    hand: [],
    score: 0,
    cleared: 0,
    turnNumber: 1,
    turnOrder: players.map((player) => player.id),
    turnIndex: 0,
    currentPlayerId: players[0].id,
    message: GAME_TEXT.playerTurn(players[0].name),
    turnEndsAt: Date.now() + TURN_DURATION_MS,
    lastPlacement: [],
    lastClear: null,
    finished: false,
  };
  fillHand(game);
  return game;
}

export function placeGamePiece(game, playerId, move, players) {
  if (game.finished) throw new GameError('GAME_FINISHED', ERROR_TEXT.gameFinished);
  if (game.turnEndsAt && Date.now() >= game.turnEndsAt) {
    throw new GameError('TURN_EXPIRED', '制限時間を過ぎています。次のターンを待ってください。');
  }
  if (game.currentPlayerId !== playerId) throw new GameError('NOT_YOUR_TURN', ERROR_TEXT.notYourTurn);

  const { pieceId, x, y, rotation = 0 } = move ?? {};
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(rotation)) {
    throw new GameError('INVALID_MOVE', ERROR_TEXT.invalidMove);
  }

  const pieceIndex = game.hand.findIndex((piece) => piece.id === pieceId);
  if (pieceIndex === -1) throw new GameError('PIECE_NOT_FOUND', ERROR_TEXT.pieceNotFound);

  const piece = game.hand[pieceIndex];
  const rotatedPiece = { ...piece, cells: rotateCells(piece.cells, rotation) };
  if (!canPlacePiece(game.board, rotatedPiece, x, y)) {
    throw new GameError('CANNOT_PLACE', ERROR_TEXT.cannotPlace);
  }

  placePiece(game.board, rotatedPiece, x, y);
  game.lastPlacement = rotatedPiece.cells.map(([offsetX, offsetY]) => ({
    x: x + offsetX,
    y: y + offsetY,
  }));
  const completedLines = getCompletedLines(game.board);
  const cleared = clearLines(game.board);
  game.lastClear = cleared > 0
    ? {
        id: `${game.turnNumber}-${Date.now()}`,
        rows: completedLines.rows,
        columns: completedLines.columns,
      }
    : null;
  game.cleared += cleared;
  game.score += cleared * 100;
  game.hand.splice(pieceIndex, 1, createRandomPiece());

  if (!canPlaceAnyPiece(game)) {
    game.finished = true;
    game.turnEndsAt = null;
    game.message = GAME_TEXT.noPlaceablePieces;
    return { finished: true, cleared };
  }

  advanceTurn(game, players);
  return { finished: false, cleared };
}

export function expireGameTurn(game, players, expectedTurnEndsAt, now = Date.now()) {
  if (game.finished || game.turnEndsAt !== expectedTurnEndsAt || now < game.turnEndsAt) return false;
  const expiredPlayer = findPlayer(players, game.currentPlayerId);
  advanceTurn(game, players, now);
  const currentPlayer = findPlayer(players, game.currentPlayerId);
  game.message = `${expiredPlayer?.name ?? ''}さんは時間切れです。${currentPlayer?.name ?? ''}さんのターンです。`;
  return true;
}

export function removePlayerFromGame(game, playerId, remainingPlayers) {
  if (!game) return;
  const removedIndex = game.turnOrder.indexOf(playerId);
  if (removedIndex === -1) return;

  const wasCurrentPlayer = game.currentPlayerId === playerId;
  game.turnOrder.splice(removedIndex, 1);
  if (removedIndex < game.turnIndex) game.turnIndex -= 1;

  if (game.turnOrder.length === 0) {
    game.turnIndex = 0;
    setCurrentPlayer(game, remainingPlayers);
    return;
  }

  if (game.turnIndex >= game.turnOrder.length) game.turnIndex = 0;
  if (wasCurrentPlayer) game.turnNumber += 1;
  if (wasCurrentPlayer) setCurrentPlayer(game, remainingPlayers);
}
