const NAME_MAX_LENGTH = 16;
const ROOM_ID_MIN_LENGTH = 2;
const ROOM_ID_MAX_LENGTH = 24;

const state = {
  screen: 'name',
  playerName: '',
  roomMode: 'create',
  roomId: '',
};

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}

function normalizeInput(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function validateName(value) {
  const name = normalizeInput(value);
  if (!name) return '名前を入力してください。';
  if (name.length > NAME_MAX_LENGTH) return `名前は${NAME_MAX_LENGTH}文字以内で入力してください。`;
  return '';
}

function validateRoomId(value) {
  const roomId = normalizeInput(value);
  if (!roomId) return '合言葉を入力してください。';
  if (roomId.length < ROOM_ID_MIN_LENGTH) return `合言葉は${ROOM_ID_MIN_LENGTH}文字以上で入力してください。`;
  if (roomId.length > ROOM_ID_MAX_LENGTH) return `合言葉は${ROOM_ID_MAX_LENGTH}文字以内で入力してください。`;
  return '';
}

function renderBrand() {
  return `
    <div class="entry-brand" aria-label="Slow Life Blocks">
      <span class="brand-mark" aria-hidden="true">
        <i></i><i></i><i></i><i></i>
      </span>
      <span>Slow Life Blocks</span>
    </div>
  `;
}

function renderNameScreen() {
  return `
    <main class="entry-page">
      <section class="entry-card" aria-labelledby="entry-title">
        ${renderBrand()}
        <div class="entry-copy">
          <p class="eyebrow">CO-OP PUZZLE</p>
          <h1 id="entry-title">みんなで、ひとつの盤面を。</h1>
          <p>名前を決めたら、仲間の部屋へ向かいましょう。</p>
        </div>

        <form id="name-form" class="entry-form" novalidate>
          <label for="player-name">あなたの名前</label>
          <div class="input-wrap">
            <input
              id="player-name"
              name="playerName"
              type="text"
              value="${escapeHtml(state.playerName)}"
              maxlength="${NAME_MAX_LENGTH}"
              autocomplete="nickname"
              placeholder="例：dongu"
              aria-describedby="name-hint name-error"
              autofocus
            />
            <span class="input-count" id="name-count">${state.playerName.length}/${NAME_MAX_LENGTH}</span>
          </div>
          <p class="field-hint" id="name-hint">部屋のメンバーに表示される名前です。</p>
          <p class="field-error" id="name-error" role="alert"></p>
          <button class="primary-button" type="submit">
            次へ
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
    </main>
  `;
}

function renderRoomScreen() {
  const isCreateMode = state.roomMode === 'create';
  const title = isCreateMode ? '新しい部屋を作る' : '部屋に参加する';
  const description = isCreateMode
    ? '仲間に伝える合言葉を決めてください。'
    : '仲間から教えてもらった合言葉を入力してください。';

  return `
    <main class="entry-page">
      <section class="entry-card room-card" aria-labelledby="room-title">
        ${renderBrand()}

        <div class="player-chip">
          <span class="player-avatar" aria-hidden="true">${escapeHtml(state.playerName.slice(0, 1).toUpperCase())}</span>
          <span><small>プレイヤー</small>${escapeHtml(state.playerName)}</span>
          <button id="edit-name" type="button">変更</button>
        </div>

        <div class="mode-switch" role="tablist" aria-label="部屋への入り方">
          <button
            type="button"
            role="tab"
            data-room-mode="create"
            aria-selected="${isCreateMode}"
            class="${isCreateMode ? 'active' : ''}"
          >部屋を作る</button>
          <button
            type="button"
            role="tab"
            data-room-mode="join"
            aria-selected="${!isCreateMode}"
            class="${!isCreateMode ? 'active' : ''}"
          >部屋に参加</button>
        </div>

        <div class="entry-copy compact">
          <p class="eyebrow">ROOM</p>
          <h1 id="room-title">${title}</h1>
          <p>${description}</p>
        </div>

        <form id="room-form" class="entry-form" novalidate>
          <label for="room-id">合言葉 <span>＝ ルームID</span></label>
          <input
            id="room-id"
            name="roomId"
            type="text"
            value="${escapeHtml(state.roomId)}"
            minlength="${ROOM_ID_MIN_LENGTH}"
            maxlength="${ROOM_ID_MAX_LENGTH}"
            autocomplete="off"
            spellcheck="false"
            placeholder="例：slow-life"
            aria-describedby="room-hint room-error"
            autofocus
          />
          <p class="field-hint" id="room-hint">英数字・日本語のどちらでも使えます。</p>
          <p class="field-error" id="room-error" role="alert"></p>
          <button class="primary-button" type="submit">
            ${isCreateMode ? '部屋を作成' : '部屋に参加'}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
    </main>
  `;
}

export function createEntryFlow(root, { onRoomRequest = () => {} } = {}) {
  function render() {
    root.innerHTML = state.screen === 'name' ? renderNameScreen() : renderRoomScreen();
    bindEvents();
  }

  function showError(id, message) {
    const error = root.querySelector(`#${id}`);
    const input = error?.closest('form')?.querySelector('input');
    if (error) error.textContent = message;
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function bindEvents() {
    const nameForm = root.querySelector('#name-form');
    if (nameForm) {
      const input = nameForm.elements.playerName;
      const count = root.querySelector('#name-count');

      input.addEventListener('input', () => {
        state.playerName = input.value;
        count.textContent = `${input.value.length}/${NAME_MAX_LENGTH}`;
        showError('name-error', '');
      });

      nameForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const error = validateName(input.value);
        showError('name-error', error);
        if (error) return input.focus();

        state.playerName = normalizeInput(input.value);
        state.screen = 'room';
        render();
      });
      return;
    }

    root.querySelector('#edit-name').addEventListener('click', () => {
      state.screen = 'name';
      render();
    });

    root.querySelectorAll('[data-room-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        state.roomMode = button.dataset.roomMode;
        render();
      });
    });

    const roomForm = root.querySelector('#room-form');
    const roomInput = roomForm.elements.roomId;
    roomInput.addEventListener('input', () => {
      state.roomId = roomInput.value;
      showError('room-error', '');
    });

    roomForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = validateRoomId(roomInput.value);
      showError('room-error', error);
      if (error) return roomInput.focus();

      state.roomId = normalizeInput(roomInput.value);
      const submitButton = roomForm.querySelector('[type="submit"]');
      submitButton.disabled = true;
      submitButton.setAttribute('aria-busy', 'true');

      try {
        await onRoomRequest({
          type: state.roomMode,
          playerName: state.playerName,
          roomId: state.roomId,
        });
      } catch (requestError) {
        showError('room-error', requestError.message);
        roomInput.focus();
        submitButton.disabled = false;
        submitButton.removeAttribute('aria-busy');
      }
    });
  }

  render();
}
