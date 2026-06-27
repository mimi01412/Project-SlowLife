import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { createRoomService } from './room/roomService.js';
import { registerRoomHandlers } from './socket/registerRoomHandlers.js';

const port = Number(process.env.PORT) || 5173;
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const app = express();
const httpServer = createServer(app);
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

app.get('/health', (request, response) => {
  response.send('ok');
});

const io = new Server(httpServer, {
  cors: {
    origin: clientUrl,
    methods: ['GET', 'POST'],
  },
});
const roomService = createRoomService();

io.on('connection', (socket) => registerRoomHandlers(io, socket, roomService));

if (isProduction) {
  const distDirectory = path.join(rootDirectory, 'dist');
  app.use(express.static(distDirectory));
  app.use((request, response, next) => {
    if (request.method !== 'GET') return next();
    response.sendFile(path.join(distDirectory, 'index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root: rootDirectory,
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

httpServer.listen(port, () => {
  console.log(`Slow Life Blocks: http://localhost:${port}`);
});
