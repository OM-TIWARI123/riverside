import { verifyToken, extractTokenFromHeader } from '../services/auth.js';
import prisma from '../prisma/client.js';


export async function authenticateToken(req, res, next) {
  try {
    const token = extractTokenFromHeader(req);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token required'
      });
    }
    
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    
    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
      }
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

/**
 * Optional auth middleware (doesn't fail if no token)
 */
export async function optionalAuth(req, res, next) {
  try {
    const token = extractTokenFromHeader(req);
    
    if (token) {
      const decoded = verifyToken(token);
      
      if (decoded) {
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: {
            id: true,
            email: true,
            username: true,
            createdAt: true,
          }
        });
        
        if (user) {
          req.user = user;
        }
      }
    }
    
    next();
  } catch (error) {
    next();
  }
}
