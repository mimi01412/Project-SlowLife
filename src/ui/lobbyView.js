import { UI_TEXT } from '../content/text.js';

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}

export function renderLobby(root, { room, selfId, onLeave, onStart }) {
  const isHost = room.hostId === selfId;
  const players = room.players
    .map((player, index) => {
      const playerIsHost = player.id === room.hostId;
      const playerIsSelf = player.id === selfId;
      return `
        <li class="lobby-player${playerIsSelf ? ' is-self' : ''}">
          <span class="lobby-avatar" style="--avatar-hue: ${190 + index * 31}">
            ${escapeHtml(player.name.slice(0, 1).toUpperCase())}
          </span>
          <span class="lobby-player-name">
            ${escapeHtml(player.name)}
            ${playerIsSelf ? `<small>${UI_TEXT.common.self}</small>` : ''}
          </span>
          ${playerIsHost ? `<span class="host-badge">${UI_TEXT.lobby.hostBadge}</span>` : ''}
        </li>
      `;
    })
    .join('');

  root.innerHTML = `
    <main class="lobby-page">
      <section class="lobby-shell" aria-labelledby="lobby-title">
        <header class="lobby-header">
          <div>
            <p class="eyebrow">${UI_TEXT.lobby.category}</p>
            <h1 id="lobby-title">${UI_TEXT.lobby.title}</h1>
          </div>
          <button id="leave-room" class="text-button" type="button">${UI_TEXT.common.leave}</button>
        </header>

        <div class="room-code-panel">
          <span>${UI_TEXT.lobby.roomIdLabel}</span>
          <strong>${escapeHtml(room.id)}</strong>
          <small>${UI_TEXT.lobby.roomIdHint}</small>
        </div>

        <section class="players-panel" aria-labelledby="players-title">
          <div class="players-heading">
            <h2 id="players-title">${UI_TEXT.common.players}</h2>
            <span>${room.players.length} / ${room.maxPlayers}</span>
          </div>
          <ul class="lobby-players">${players}</ul>
        </section>

        <div class="lobby-action">
          ${
            isHost
              ? `<button id="start-game" class="primary-button" type="button">${UI_TEXT.lobby.start} <span>→</span></button><p id="start-error" class="action-error" role="alert"></p>`
              : `<div class="waiting-indicator"><i></i><span>${UI_TEXT.lobby.waitingForHost}</span></div>`
          }
        </div>
      </section>
    </main>
  `;

  root.querySelector('#leave-room').addEventListener('click', onLeave);

  const startButton = root.querySelector('#start-game');
  startButton?.addEventListener('click', async () => {
    startButton.disabled = true;
    startButton.setAttribute('aria-busy', 'true');
    try {
      await onStart();
    } catch (error) {
      root.querySelector('#start-error').textContent = error.message;
      startButton.disabled = false;
      startButton.removeAttribute('aria-busy');
    }
  });
}
