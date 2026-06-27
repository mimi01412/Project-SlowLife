import { io } from 'socket.io-client';

const REQUEST_TIMEOUT = 5000;

export function createRoomClient() {
  const socket = io();

  function request(event, payload) {
    return new Promise((resolve, reject) => {
      const handleResponse = (timeoutError, response) => {
        if (timeoutError) return reject(new Error('サーバーに接続できませんでした。もう一度お試しください。'));
        if (!response?.ok) return reject(new Error(response?.error?.message ?? '通信エラーが発生しました。'));
        resolve(response);
      };

      const requestSocket = socket.timeout(REQUEST_TIMEOUT);
      if (payload === undefined) requestSocket.emit(event, handleResponse);
      else requestSocket.emit(event, payload, handleResponse);
    });
  }

  return {
    createRoom: (payload) => request('room:create', payload),
    joinRoom: (payload) => request('room:join', payload),
    resumeRoom: (payload) => request('room:resume', payload),
    startRoom: () => request('room:start'),
    placePiece: (payload) => request('game:place', payload),
    leaveRoom: () => request('room:leave'),
    onRoomState(handler) {
      socket.on('room:state', handler);
      return () => socket.off('room:state', handler);
    },
    onReconnect(handler) {
      socket.io.on('reconnect', handler);
      return () => socket.io.off('reconnect', handler);
    },
  };
}
