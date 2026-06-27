function isTouchPointer(event) {
  return event.pointerType === 'touch' || event.pointerType === 'pen';
}

export function setupControls(game, view) {
  view.onPiecePointerDown((event, index) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    if (game.state.isDragging && event.pointerId !== game.state.dragPointerId) {
      if (isTouchPointer(event)) {
        event.preventDefault();
        event.stopPropagation();
        game.rotateSelected();
        view.render();
      }
      return;
    }

    event.preventDefault();
    game.startDrag(index, event.pointerId, event.pointerType);
    view.render();
  });

  view.canvas.addEventListener('pointerleave', () => {
    if (game.state.isDragging) return;
    game.setHoverCell(null);
    view.renderBoard();
  });

  window.addEventListener('pointermove', (event) => {
    if (!game.state.isDragging || event.pointerId !== game.state.dragPointerId) return;
    game.setHoverCell(view.getCellFromPointer(event, true));
    view.renderBoard();
  });

  window.addEventListener('pointerup', (event) => {
    if (!game.state.isDragging || event.pointerId !== game.state.dragPointerId) return;

    const cell = view.getCellFromPointer(event, true);
    game.finishDrag();
    if (cell && game.placeSelected(cell.x, cell.y)) {
      view.render();
      return;
    }

    game.cancelDrag();
    view.render();
  });

  window.addEventListener('pointercancel', (event) => {
    if (!game.state.isDragging || event.pointerId !== game.state.dragPointerId) return;
    game.cancelDrag('ドラッグがキャンセルされました。');
    view.render();
  });

  window.addEventListener('pointerdown', (event) => {
    if (!game.state.isDragging || event.pointerId === game.state.dragPointerId) return;
    if (!isTouchPointer(event)) return;

    event.preventDefault();
    if (game.rotateSelected()) view.render();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Spacebar') {
      if (!game.state.isDragging) return;
      event.preventDefault();
      if (game.rotateSelected()) view.render();
      return;
    }

    if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      game.reset();
      view.render();
    }
  });
}

