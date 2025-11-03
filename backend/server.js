import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import uploadRouter from './routes/upload.js';
import recordingRouter from './routes/recording.js';
import { processRoom } from './services/merger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import authRouter from './routes/userRouter.js';
import { authenticateToken } from './middleware/auth.js';
import { authenticateSocket } from './middleware/socketAuth.js';
import prisma from './prisma/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  },
  
  auth: (socket, next) => authenticateSocket(socket, next)
});

app.use(cors());
app.use(express.json());


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.use('/api/auth', authRouter);


app.use('/api/upload', uploadRouter);

// Recording routes (require authentication)
app.use('/api/recordings', recordingRouter);

// Create new room (Protected)
app.post('/api/create-room', authenticateToken, (req, res) => {
  const roomId = uuidv4().slice(0, 8);
  
  console.log(`🎬 Room created by ${req.user.username}: ${roomId}`);
  
  res.json({ 
    roomId,
    createdBy: req.user.username,
    createdAt: new Date()
  });
});


app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  
  res.json({
    roomId,
    status: 'active'
  });
});


app.post('/api/test-process/:roomId', authenticateToken, async (req, res) => {
  const { roomId } = req.params;
  
  try {
    
    
    const roomDir = path.join(__dirname, 'uploads', roomId);
    
    if (!fs.existsSync(roomDir)) {
      return res.status(404).json({ 
        success: false,
        error: 'Room directory not found. Make sure you uploaded chunks first.' 
      });
    }
    
    // Get actual user directories from filesystem
    const allDirs = fs.readdirSync(roomDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .filter(dirent => dirent.name !== 'merged')
      .map(dirent => dirent.name);
    
    console.log(` Found ${allDirs.length} user directories:`, allDirs);
    
    // Filter to only directories with chunk files
    const validUserIds = [];
    for (const userId of allDirs) {
      const userPath = path.join(roomDir, userId);
      const chunks = fs.readdirSync(userPath)
        .filter(f => f.startsWith('chunk_') && f.endsWith('.webm'));
      
      console.log(` User ${userId}: ${chunks.length} chunks`);
      
      if (chunks.length > 0) {
        validUserIds.push(userId);
      }
    }
    
    if (validUserIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No chunks found. Upload some chunks first.' 
      });
    }
    
    console.log(` Processing ${validUserIds.length} user(s)`);
    
    // Check if recording already exists
    let recording = await prisma.recording.findUnique({
      where: { roomId }
    });
    
    // Create recording if it doesn't exist
    if (!recording) {
      recording = await prisma.recording.create({
        data: {
          userId: req.user.id,
          roomId,
          title: `Test Recording - ${new Date().toLocaleString()}`,
          status: 'processing',
          videoUrl: null,
        }
      });
      console.log(` Created recording: ${recording.id}`);
    } else {
      console.log(` Found existing recording: ${recording.id}`);
    }
    
    // Process video (this will take time - 30-60 seconds)
    console.log(`🎬 Starting video processing...`);
    const updatedRecording = await processRoom(roomId, validUserIds);
    
    res.json({
      success: true,
      message: 'Processing complete',
      recording: updatedRecording
    });
    
  } catch (error) {
    console.error(' Test processing failed:', error);
    
    // Try to update recording status to failed
    try {
      await prisma.recording.update({
        where: { roomId },
        data: { status: 'failed' }
      });
    } catch (dbError) {
      
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});



const rooms = new Map();


io.use(authenticateSocket);

io.on('connection', (socket) => {
  if (!socket.user) {
    console.error(' Socket connected without user - disconnecting');
    socket.disconnect();
    return;
  }

  const user = socket.user;
  console.log(` Socket connected: ${user.username} (${socket.id}) ${user.isGuest ? '[Guest]' : '[Auth]'}`);

  socket.on('join-room', ({ roomId, userName }) => {
    socket.join(roomId);
    socket.userName = userName || user.username;
    socket.roomId = roomId;
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: [],
        createdAt: Date.now(),
        createdBy: user.id
      });
    }
    
    const room = rooms.get(roomId);
    
    
    room.participants = room.participants.filter(p => p.socketId !== socket.id);
    
    // Remove any existing participant with this userId (in case of reconnect)
    room.participants = room.participants.filter(p => p.userId !== user.id);
    
    // Add new participant
    const participant = {
      socketId: socket.id,
      userId: user.id,
      userName: socket.userName,
      userEmail: user.email,
      isGuest: user.isGuest || false
    };
    
    room.participants.push(participant);
    
    const participantsInRoom = io.sockets.adapter.rooms.get(roomId);
    const numParticipants = participantsInRoom ? participantsInRoom.size : 0;
    
    console.log(` ${socket.userName} joined room ${roomId}. Total: ${numParticipants}`);
    
    // Notify existing users about new user (for WebRTC)
    socket.to(roomId).emit('user-joined-webrtc', {
      socketId: socket.id,
      userName: socket.userName
    });
    
    // Send list of existing participants to new user (for WebRTC)
    const existingUsers = room.participants
      .filter(p => p.socketId !== socket.id)
      .map(p => ({ socketId: p.socketId, userName: p.userName }));
    
    socket.emit('existing-users', existingUsers);
    
    // Send participant list to ALL users in room
    const uniqueParticipants = [];
    const seenSocketIds = new Set();
    
    for (const p of room.participants) {
      if (!seenSocketIds.has(p.socketId)) {
        seenSocketIds.add(p.socketId);
        uniqueParticipants.push({
          socketId: p.socketId,
          userName: p.userName,
          isGuest: p.isGuest
        });
      }
    }
    
    // Broadcast to entire room
    room.participants.forEach(participant => {
    const socket = io.sockets.sockets.get(participant.socketId);
    if (socket) {
      const otherParticipants = uniqueParticipants.filter(
        p => p.socketId !== participant.socketId
      );
      socket.emit('room-participants', otherParticipants);
    }
   }); 
    
    socket.emit('user-id', user.id);
  });

  // WebRTC signaling
  socket.on('webrtc-signal', ({ signal, to, roomId }) => {
    console.log(` Relaying WebRTC signal from ${socket.id} to ${to}`);
    io.to(to).emit('webrtc-signal', {
      signal,
      from: socket.id
    });
  });

  socket.on('start-recording', async ({ roomId }) => {
    console.log(` Start recording requested by ${user.username} for room ${roomId}`);
    
    if (user.isGuest) {
      socket.emit('error', { message: 'Guests cannot start recording' });
      return;
    }
    
    const startTime = Date.now() + 3000;
    io.to(roomId).emit('recording-start-sync', { startTime });
  });

  socket.on('stop-recording', async ({ roomId }) => {
    console.log(` Stop recording for room ${roomId} by ${user.username}`);
    
    if (user.isGuest) {
      socket.emit('error', { message: 'Guests cannot stop recording' });
      return;
    }
    
    io.to(roomId).emit('recording-stop-sync');
    
    const room = rooms.get(roomId);
    
    if (!room) {
      console.error(` Room ${roomId} not found`);
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    // Create recording entry
    let recording;
    try {
      recording = await prisma.recording.create({
        data: {
          userId: user.id,
          roomId,
          title: `Recording - ${new Date().toLocaleString()}`,
          status: 'processing',
          videoUrl: null,
        }
      });
      
      console.log(` Created recording: ${recording.id}`);
      
      io.to(roomId).emit('recording-processing', {
        recordingId: recording.id,
        message: 'Processing your recording...'
      });
      
    } catch (error) {
      console.error('❌ Failed to create recording:', error);
      io.to(roomId).emit('video-error', {
        error: 'Failed to create recording entry'
      });
      return;
    }
    
    // Wait for chunks to finish uploading
    setTimeout(async () => {
      try {
        console.log(`🎬 Starting video processing for room ${roomId}`);
        
        const roomDir = path.join(__dirname, 'uploads', roomId);
        
        if (!fs.existsSync(roomDir)) {
          throw new Error(`Room directory not found`);
        }
        
        const allDirs = fs.readdirSync(roomDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .filter(dirent => dirent.name !== 'merged')
          .map(dirent => dirent.name);
        
        console.log(`📁 Found ${allDirs.length} user directories`);
        
        const validUserIds = [];
        for (const userId of allDirs) {
          const userPath = path.join(roomDir, userId);
          const videoFile = path.join(userPath, `${userId}.webm`);
          if (fs.existsSync(videoFile)) {
          const stats = fs.statSync(videoFile);
          console.log(`📂 User ${userId}: ${(stats.size / 1024 / 1024).toFixed(2)} MB video`);
          
          if (stats.size > 0) {
            validUserIds.push(userId);
          } else {
            console.warn(`⚠️ User ${userId}: Video file is empty`);
          }
        } else {
          console.warn(`⚠️ User ${userId}: No video file found`);
        }
      
      }
        
        if (validUserIds.length === 0) {
          throw new Error('No recordings found');
        }
        
        console.log(`✅ Processing ${validUserIds.length} user(s)`);
        
        const updatedRecording = await processRoom(roomId, validUserIds);
        
        io.to(roomId).emit('video-ready', {
          downloadUrl: updatedRecording.videoUrl,
          recordingId: updatedRecording.id
        });
        
        console.log(`✅ Video processing complete`);
        
      } catch (error) {
        console.error(' Video processing failed:', error);
        
        try {
          await prisma.recording.update({
            where: { roomId },
            data: { status: 'failed' }
          });
        } catch (dbError) {
          console.error(' Failed to update recording status:', dbError);
        }
        
        io.to(roomId).emit('video-error', {
          recordingId: recording?.id,
          error: error.message
        });
      }
    }, 10000);
  });

  socket.on('disconnect', () => {
    console.log(` Client disconnected: ${user.username} (${socket.id})`);
    
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-left', {
        socketId: socket.id,
        userName: socket.userName
      });
      
      const room = rooms.get(socket.roomId);
      if (room) {
        room.participants = room.participants.filter(p => p.socketId !== socket.id);
        
        // Broadcast updated participant list
        io.to(socket.roomId).emit('room-participants', room.participants.map(p => ({
          socketId: p.socketId,
          userName: p.userName,
          isGuest: p.isGuest
        })));
        
        if (room.participants.length === 0) {
          rooms.delete(socket.roomId);
          
        }
      }
    }
  });

  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${user.username}:`, error);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(` Server running on ${PORT}`);

 
});
