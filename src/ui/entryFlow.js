import { ERROR_TEXT, UI_TEXT } from '../content/text.js';
import { IMAGE_ASSETS } from '../content/assets.js';

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
  if (!name) return ERROR_TEXT.nameRequired;
  if (name.length > NAME_MAX_LENGTH) return ERROR_TEXT.nameTooLong(NAME_MAX_LENGTH);
  return '';
}

function validateRoomId(value) {
  const roomId = normalizeInput(value);
  if (!roomId) return ERROR_TEXT.roomIdRequired;
  if (roomId.length < ROOM_ID_MIN_LENGTH) return ERROR_TEXT.roomIdTooShort(ROOM_ID_MIN_LENGTH);
  if (roomId.length > ROOM_ID_MAX_LENGTH) return ERROR_TEXT.roomIdTooLong(ROOM_ID_MAX_LENGTH);
  return '';
}

function renderBrand() {
  return `
    <div class="entry-brand" aria-label="${UI_TEXT.common.appName}">
      <span class="brand-mark" aria-hidden="true">
        <i></i><i></i><i></i><i></i>
      </span>
      <span>${UI_TEXT.common.appName}</span>
    </div>
  `;
}

function renderNameScreen() {
  return `
    <main class="entry-page">
      <section class="entry-card" aria-labelledby="entry-title">
        ${renderBrand()}
        <div class="entry-copy">
          <p class="eyebrow">${UI_TEXT.entry.category}</p>
          <h1 id="entry-title" class="entry-title-logo">
            <img
              src="${IMAGE_ASSETS.logo}"
              width="1916"
              height="821"
              alt="${UI_TEXT.common.appName}"
            />
          </h1>
          <p>${UI_TEXT.entry.description}</p>
        </div>

        <form id="name-form" class="entry-form" novalidate>
          <label for="player-name">${UI_TEXT.entry.nameLabel}</label>
          <div class="input-wrap">
            <input
              id="player-name"
              name="playerName"
              type="text"
              value="${escapeHtml(state.playerName)}"
              maxlength="${NAME_MAX_LENGTH}"
              autocomplete="nickname"
              placeholder="${UI_TEXT.entry.namePlaceholder}"
              aria-describedby="name-hint name-error"
              autofocus
            />
            <span class="input-count" id="name-count">${state.playerName.length}/${NAME_MAX_LENGTH}</span>
          </div>
          <p class="field-hint" id="name-hint">${UI_TEXT.entry.nameHint}</p>
          <p class="field-error" id="name-error" role="alert"></p>
          <button class="primary-button" type="submit">
            ${UI_TEXT.entry.next}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
    </main>
  `;
}

function renderRoomScreen() {
  const isCreateMode = state.roomMode === 'create';
  const title = isCreateMode ? UI_TEXT.entry.createRoomTitle : UI_TEXT.entry.joinRoomTitle;
  const description = isCreateMode
    ? UI_TEXT.entry.createRoomDescription
    : UI_TEXT.entry.joinRoomDescription;

  return `
    <main class="entry-page">
      <section class="entry-card room-card" aria-labelledby="room-title">
        ${renderBrand()}

        <div class="player-chip">
          <span class="player-avatar" aria-hidden="true">${escapeHtml(state.playerName.slice(0, 1).toUpperCase())}</span>
          <span><small>${UI_TEXT.entry.player}</small>${escapeHtml(state.playerName)}</span>
          <button id="edit-name" type="button">${UI_TEXT.entry.edit}</button>
        </div>

        <div class="mode-switch" role="tablist" aria-label="${UI_TEXT.entry.roomModeLabel}">
          <button
            type="button"
            role="tab"
            data-room-mode="create"
            aria-selected="${isCreateMode}"
            class="${isCreateMode ? 'active' : ''}"
          >${UI_TEXT.entry.createRoomTab}</button>
          <button
            type="button"
            role="tab"
            data-room-mode="join"
            aria-selected="${!isCreateMode}"
            class="${!isCreateMode ? 'active' : ''}"
          >${UI_TEXT.entry.joinRoomTab}</button>
        </div>

        <div class="entry-copy compact">
          <p class="eyebrow">ROOM</p>
          <h1 id="room-title">${title}</h1>
          <p>${description}</p>
        </div>

        <form id="room-form" class="entry-form" novalidate>
          <label for="room-id">${UI_TEXT.entry.roomIdLabel} <span>${UI_TEXT.entry.roomIdSupplement}</span></label>
          <input
            id="room-id"
            name="roomId"
            type="text"
            value="${escapeHtml(state.roomId)}"
            minlength="${ROOM_ID_MIN_LENGTH}"
            maxlength="${ROOM_ID_MAX_LENGTH}"
            autocomplete="off"
            spellcheck="false"
            placeholder="${UI_TEXT.entry.roomIdPlaceholder}"
            aria-describedby="room-hint room-error"
            autofocus
          />
          <p class="field-hint" id="room-hint">${UI_TEXT.entry.roomIdHint}</p>
          <p class="field-error" id="room-error" role="alert"></p>
          <button class="primary-button" type="submit">
            ${isCreateMode ? UI_TEXT.entry.createRoomSubmit : UI_TEXT.entry.joinRoomSubmit}
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
