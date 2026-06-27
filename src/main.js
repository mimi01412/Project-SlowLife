import './style.css';
import { createGame } from './game/game.js';
import { setupControls } from './input/controls.js';
import { createGameView } from './ui/gameView.js';

const app = document.querySelector('#app');
const game = createGame();
const view = createGameView(app, game);

setupControls(game, view);
view.render();
