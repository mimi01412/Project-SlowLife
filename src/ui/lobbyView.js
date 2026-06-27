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
            ${playerIsSelf ? '<small>あなた</small>' : ''}
          </span>
          ${playerIsHost ? '<span class="host-badge">HOST</span>' : ''}
        </li>
      `;
    })
    .join('');

  root.innerHTML = `
    <main class="lobby-page">
      <section class="lobby-shell" aria-labelledby="lobby-title">
        <header class="lobby-header">
          <div>
            <p class="eyebrow">WAITING ROOM</p>
            <h1 id="lobby-title">仲間を待っています</h1>
          </div>
          <button id="leave-room" class="text-button" type="button">退出する</button>
        </header>

        <div class="room-code-panel">
          <span>合言葉 / ルームID</span>
          <strong>${escapeHtml(room.id)}</strong>
          <small>この合言葉を仲間に伝えてください</small>
        </div>

        <section class="players-panel" aria-labelledby="players-title">
          <div class="players-heading">
            <h2 id="players-title">参加メンバー</h2>
            <span>${room.players.length} / ${room.maxPlayers}</span>
          </div>
          <ul class="lobby-players">${players}</ul>
        </section>

        <div class="lobby-action">
          ${
            isHost
              ? '<button id="start-game" class="primary-button" type="button">Play <span>→</span></button><p id="start-error" class="action-error" role="alert"></p>'
              : '<div class="waiting-indicator"><i></i><span>ホストの開始を待っています</span></div>'
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
