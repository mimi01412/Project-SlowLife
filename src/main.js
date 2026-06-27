import './style.css';
import { createEntryFlow } from './ui/entryFlow.js';

const app = document.querySelector('#app');

createEntryFlow(app, {
  onRoomRequest(request) {
    // The transport will be connected here in the next implementation stage.
    console.info('Room request ready:', request);
  },
});
