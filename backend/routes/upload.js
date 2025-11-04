
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Store active upload sessions
const uploadSessions = new Map();

// 🎯 Step 1: Initialize upload session
router.post('/init-session', authenticateToken, async (req, res) => {
  try {
    const { roomId, userId, totalSize, totalChunks } = req.body;
    
    const sessionId = uuidv4();
    const uploadPath = path.join(__dirname, '..', 'uploads', roomId, userId);
    
    // Create directory
    fs.mkdirSync(uploadPath, { recursive: true });
    
    // Store session info
    uploadSessions.set(sessionId, {
      roomId,
      userId,
      uploadPath,
      totalChunks,
      totalSize,
      receivedChunks: [],
      createdAt: Date.now()
    });
    
    console.log(`✅ Upload session created: ${sessionId}`);
    console.log(`   Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Total chunks: ${totalChunks}`);
    
    res.json({ 
      success: true, 
      sessionId 
    });
    
  } catch (error) {
    console.error('❌ Session init error:', error);
    res.status(500).json({ error: 'Failed to initialize session' });
  }
});

// 🎯 Step 2: Upload individual chunks
// FIX: Get sessionId from query params, not body
const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { sessionId } = req.query; // ✅ Use query params
    const session = uploadSessions.get(sessionId);
    
    if (!session) {
      console.error(`❌ Invalid session: ${sessionId}`);
      return cb(new Error('Invalid session'));
    }
    
    cb(null, session.uploadPath);
  },
  filename: (req, file, cb) => {
    const { chunkIndex } = req.query; // ✅ Use query params
    cb(null, `chunk_${chunkIndex}.webm`);
  }
});

const uploadChunk = multer({ 
  storage: chunkStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB per chunk
});

router.post('/chunk', authenticateToken, uploadChunk.single('chunk'), async (req, res) => {
  try {
    const { sessionId, chunkIndex, totalChunks } = req.query; // ✅ Use query params
    
    const session = uploadSessions.get(sessionId);
    
    if (!session) {
      return res.status(400).json({ error: 'Invalid session' });
    }
    
    // Mark chunk as received
    session.receivedChunks.push(parseInt(chunkIndex));
    
    console.log(`✅ Chunk ${chunkIndex}/${totalChunks} uploaded (Session: ${sessionId.slice(0, 8)})`);
    
    res.json({ 
      success: true,
      chunkIndex: parseInt(chunkIndex),
      received: session.receivedChunks.length,
      total: session.totalChunks
    });
    
  } catch (error) {
    console.error('❌ Chunk upload error:', error);
    res.status(500).json({ error: 'Chunk upload failed' });
  }
});

// 🎯 Step 3: Finalize upload (reassemble chunks)
router.post('/finalize-session', authenticateToken, async (req, res) => {
  try {
    const { sessionId, roomId, userId } = req.body;
    
    const session = uploadSessions.get(sessionId);
    
    if (!session) {
      return res.status(400).json({ error: 'Invalid session' });
    }
    
    console.log(`🔗 Finalizing upload session: ${sessionId.slice(0, 8)}`);
    console.log(`   Received chunks: ${session.receivedChunks.length}/${session.totalChunks}`);
    
    // Verify all chunks received
    if (session.receivedChunks.length !== session.totalChunks) {
      return res.status(400).json({ 
        error: 'Missing chunks',
        received: session.receivedChunks.length,
        expected: session.totalChunks
      });
    }
    
    // Sort chunks
    const sortedChunks = session.receivedChunks.sort((a, b) => a - b);
    
    // Reassemble video
    const outputPath = path.join(session.uploadPath, `${userId}.webm`);
    const writeStream = fs.createWriteStream(outputPath);
    
    for (const chunkIndex of sortedChunks) {
      const chunkPath = path.join(session.uploadPath, `chunk_${chunkIndex}.webm`);
      const chunkData = fs.readFileSync(chunkPath);
      writeStream.write(chunkData);
      
      // Delete chunk after merging
      fs.unlinkSync(chunkPath);
    }
    
    writeStream.end();
    
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    const stats = fs.statSync(outputPath);
    console.log(`✅ Video reassembled: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Clean up session
    uploadSessions.delete(sessionId);
    
    res.json({ 
      success: true,
      message: 'Upload finalized',
      fileSize: stats.size
    });
    
  } catch (error) {
    console.error('❌ Finalization error:', error);
    res.status(500).json({ error: 'Failed to finalize upload' });
  }
});

export default router;