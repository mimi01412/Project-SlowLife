import { UI_TEXT } from '../content/text.js';

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // 権限などで失敗した場合は、下の互換処理を試します。
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();

  try {
    if (!document.execCommand('copy')) throw new Error('Copy failed');
  } finally {
    textarea.remove();
  }
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
          <button
            id="copy-room-code"
            class="room-code-copy-icon"
            type="button"
            aria-label="${escapeHtml(`${UI_TEXT.lobby.copyRoomId}: ${room.id}`)}"
          >
            <svg class="copy-icon" viewBox="0 0 24 24">
              <rect x="8" y="8" width="11" height="11" rx="2"></rect>
              <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>
            </svg>
            <svg class="check-icon" viewBox="0 0 24 24">
              <path d="m5 12 4 4L19 6"></path>
            </svg>
          </button>
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

  const copyButton = root.querySelector('#copy-room-code');
  let copyStatusTimer = null;
  copyButton.addEventListener('click', async () => {
    if (copyStatusTimer) window.clearTimeout(copyStatusTimer);
    try {
      await copyText(room.id);
      copyButton.classList.add('is-copied');
      copyStatusTimer = window.setTimeout(() => {
        copyButton.classList.remove('is-copied');
      }, 1800);
    } catch {}
  });

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
