import { verifyToken } from '../services/auth.js';
import prisma from '../prisma/client.js';

export async function authenticateSocket(socket, next) {
  try {
    // Extract token
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.split(' ')[1];
    
    // If no token, allow as guest
    if (!token) {
      console.log(`👤 Guest connection (no token)`);
      
      // Create guest user object
      socket.user = {
        id: `guest-${socket.id}`,
        username: socket.handshake.auth.guestName || 'Guest',
        email: null,
        isGuest: true
      };
      
      socket.userId = socket.user.id;
      console.log(`✅ Guest authenticated: ${socket.user.username}`);
      return next();
    }
    
    // Verify token for authenticated users
    const decoded = verifyToken(token);
    if (!decoded) {
      console.warn(`❌ Invalid token, allowing as guest`);
      
      socket.user = {
        id: `guest-${socket.id}`,
        username: socket.handshake.auth.guestName || 'Guest',
        email: null,
        isGuest: true
      };
      
      socket.userId = socket.user.id;
      return next();
    }
    
    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        username: true,
      }
    });
    
    if (!user) {
      console.warn(`❌ User not found, allowing as guest`);
      
      socket.user = {
        id: `guest-${socket.id}`,
        username: socket.handshake.auth.guestName || 'Guest',
        email: null,
        isGuest: true
      };
      
      socket.userId = socket.user.id;
      return next();
    }
    
    // Authenticated user
    socket.user = {
      ...user,
      isGuest: false
    };
    socket.userId = user.id;
    
    console.log(`✅ Authenticated user: ${user.username} (${user.id})`);
    next();
    
  } catch (error) {
    console.error('❌ Socket authentication error:', error);
    
    // On error, still allow as guest
    socket.user = {
      id: `guest-${socket.id}`,
      username: socket.handshake.auth.guestName || 'Guest',
      email: null,
      isGuest: true
    };
    
    socket.userId = socket.user.id;
    next();
  }
}
