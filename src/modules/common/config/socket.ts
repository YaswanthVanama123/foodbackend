import { Server } from 'socket.io';
import http from 'http';

export const initializeSocket = (server: http.Server) => {
  // Socket.io with CORS allowing all origins (No restrictions)
  const io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  return io;
};
