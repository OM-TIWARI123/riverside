import prisma from '../prisma/client.js';
import { hashPassword, comparePassword, generateToken } from '../services/auth.js';

/**
 * User signup handler
 */
export async function handleUserSignup(req, res) {
  try {
    const { username, email, password } = req.body;
    
    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: existingUser.email === email 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      }
    });
    
    // Generate token
    const token = generateToken(user);
    
    console.log(`✅ User registered: ${user.email}`);
    
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user,
      token
    });
    
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to register user'
    });
  }
}

/**
 * User login handler
 */
export async function handleUserLogin(req, res) {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Compare password
    const isPasswordValid = await comparePassword(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Generate token
    const token = generateToken(user);
    
    console.log(`✅ User logged in: ${user.email}`);
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to login'
    });
  }
}

/**
 * Get current user (requires authentication)
 */
export async function handleGetMe(req, res) {
  try {
    return res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
}


