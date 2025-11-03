import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Middleware to check auth before any upload endpoint
router.use(authenticateToken);

const completeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { roomId, userId } = req.query;
    const uploadPath = path.join(__dirname, '..', 'uploads', roomId, userId);
    
    console.log(`✅ Directory ready: ${uploadPath}`);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const { userId } = req.query;
    const filename = `${userId}.webm`; // Single complete file
    console.log(`📝 Saving as: ${filename}`);
    cb(null, filename);
  }
});

const uploadComplete = multer({ 
  storage: completeStorage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Debug middleware
router.use('/chunk', (req, res, next) => {
  console.log('\n========================================');
  console.log('INCOMING REQUEST TO /api/upload/chunk');
  console.log('User:', req.user.username);
  console.log('Full URL:', req.protocol + '://' + req.get('host') + req.originalUrl);
  console.log('req.query:', JSON.stringify(req.query));
  console.log('========================================\n');
  next();
});

router.post('/complete', uploadComplete.single('video'), async (req, res) => {
  try {
    const { roomId, userId, userName } = req.query;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const fileSize = req.file.size;
    console.log(`✅ Complete video uploaded: ${userName}`);
    console.log(`📏 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    res.json({ 
      success: true, 
      message: 'Video uploaded successfully',
      fileSize 
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('[Multer Destination] Starting...');
    
    const roomId = req.query.roomId;
    const userId = req.query.userId;
    
    // Verify userId matches authenticated user
    if (userId !== req.user.id) {
      console.error('❌ User ID mismatch - potential security issue');
      return cb(new Error('Unauthorized: User ID mismatch'));
    }
    
    if (!roomId || !userId) {
      console.error('❌ Missing roomId or userId');
      return cb(new Error('Missing roomId or userId'));
    }
    
    const uploadDir = path.join(__dirname, '..', 'uploads', roomId, userId);
    
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`✅ Directory ready: ${uploadDir}`);
      cb(null, uploadDir);
    } catch (err) {
      console.error('❌ Error creating directory:', err);
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const chunkIndex = req.query.chunkIndex || '0';
    const filename = `chunk_${chunkIndex}.webm`;
    console.log(`📝 Saving as: ${filename}`);
    cb(null, filename);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

/**
 * Upload chunk endpoint (Protected)
 */
router.post('/chunk', upload.single('chunk'), async (req, res) => {
  try {
    const { roomId, userId, userName, chunkIndex } = req.query;
    
    // Security: Verify userId matches authenticated user
    if (userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Cannot upload chunks for other users'
      });
    }
    
    console.log(`✅ Chunk ${chunkIndex} uploaded by ${req.user.username}`);
    console.log(`📏 File size: ${req.file.size} bytes`);
    
    res.json({
      success: true,
      message: 'Chunk uploaded successfully',
      chunkIndex: parseInt(chunkIndex),
      fileSize: req.file.size,
      filePath: req.file.path
    });
  } catch (error) {
    console.error('Chunk upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload chunk'
    });
  }
});

/**
 * Finalize recording endpoint (Protected)
 */
router.post('/finalize', async (req, res) => {
  try {
    const { roomId, userId, userName } = req.body;
    
    // Security: Verify userId matches authenticated user
    if (userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Cannot finalize recordings for other users'
      });
    }
    
    console.log(`✅ Recording finalized by ${req.user.username}`);
    
    res.json({ 
      success: true,
      message: 'Recording finalized successfully'
    });
  } catch (error) {
    console.error('Finalize error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to finalize recording'
    });
  }
});

export default router;
