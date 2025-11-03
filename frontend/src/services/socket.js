import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000';

let socket = null;

export const initializeSocket = (token, guestName = null) => {
  if (!socket) {
    const auth = token 
      ? { token } 
      : { guestName: guestName || 'Guest User' };
    
    socket = io(SOCKET_URL, {
      auth,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });
  }
  return socket;
};

export const getSocket = () => {
  if (!socket) {
    throw new Error('Socket not initialized. Call initializeSocket first.');
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
