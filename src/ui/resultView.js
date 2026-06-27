import { UI_TEXT } from '../content/text.js';

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}

export function renderResultView(root, { room, selfId, onRematch, onReturnLobby, onLeave }) {
  const isHost = room.hostId === selfId;
  const hasDisconnectedPlayer = room.players.some((player) => !player.connected);
  const players = room.players
    .map(
      (player) => `
        <li class="result-player${player.connected ? '' : ' is-offline'}">
          <span>${escapeHtml(player.name.slice(0, 1).toUpperCase())}</span>
          <strong>${escapeHtml(player.name)}</strong>
          ${player.id === room.hostId ? `<small>${UI_TEXT.lobby.hostBadge}</small>` : ''}
        </li>
      `,
    )
    .join('');

  root.innerHTML = `
    <main class="result-page">
      <section class="result-card" aria-labelledby="result-title">
        <header class="result-header">
          <div>
            <p>${UI_TEXT.game.roomLabel} ${escapeHtml(room.id)}</p>
            <h1 id="result-title">${UI_TEXT.result.title}</h1>
          </div>
          <button id="leave-result" class="text-button" type="button">${UI_TEXT.common.leave}</button>
        </header>

        <div class="result-score">
          <span class="result-mark" aria-hidden="true">★</span>
          <small>${UI_TEXT.result.teamScore}</small>
          <strong>${room.game.score.toLocaleString()}</strong>
          <p>${UI_TEXT.result.description}</p>
        </div>

        <dl class="result-stats">
          <div><dt>${UI_TEXT.result.clearedLines}</dt><dd>${room.game.cleared}</dd></div>
          <div><dt>${UI_TEXT.result.totalTurns}</dt><dd>${room.game.turnNumber}</dd></div>
          <div><dt>${UI_TEXT.result.playerCount}</dt><dd>${room.players.length}</dd></div>
        </dl>

        <section class="result-members" aria-labelledby="result-members-title">
          <h2 id="result-members-title">${UI_TEXT.common.players}</h2>
          <ul>${players}</ul>
        </section>

        <div class="result-actions">
          ${
            isHost
              ? `
                <button id="rematch" class="primary-button" type="button" ${hasDisconnectedPlayer ? 'disabled' : ''}>
                  ${UI_TEXT.result.rematch} <span>↻</span>
                </button>
                <button id="return-lobby" class="secondary-button" type="button">${UI_TEXT.result.returnToLobby}</button>
                ${hasDisconnectedPlayer ? `<p>${UI_TEXT.result.reconnectNotice}</p>` : ''}
              `
              : `<div class="waiting-indicator"><i></i><span>${UI_TEXT.result.waitingForHost}</span></div>`
          }
          <p id="result-error" class="action-error" role="alert"></p>
        </div>
      </section>
    </main>
  `;

  const actionButtons = [...root.querySelectorAll('#rematch, #return-lobby')];
  const runAction = async (action) => {
    actionButtons.forEach((button) => {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    });
    try {
      await action();
    } catch (error) {
      root.querySelector('#result-error').textContent = error.message;
      actionButtons.forEach((button) => {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      });
    }
  };

  root.querySelector('#rematch')?.addEventListener('click', () => runAction(onRematch));
  root.querySelector('#return-lobby')?.addEventListener('click', () => runAction(onReturnLobby));
  root.querySelector('#leave-result').addEventListener('click', onLeave);
}
