import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { generateSignedUrl } from '../services/s3.js';
import prisma from '../prisma/client.js'

const router = express.Router();

/**
 * Get user's recordings
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const recordings = await prisma.recording.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        roomId: true,
        title: true,
        videoUrl: true,
        status: true,
        duration: true,
        createdAt: true,
      }
    });
    
    // Generate signed URLs for all recordings
    const recordingsWithSignedUrls = await Promise.all(
      recordings.map(async (recording) => {
        if (recording.videoUrl && recording.status === 'completed') {
          try {
            // Extract S3 key from permanent URL
            const s3Key = recording.videoUrl.split('.amazonaws.com/')[1];
            
            // Generate signed URL (valid for 1 hour)
            const signedUrl = await generateSignedUrl(s3Key, 3600);
            
            return {
              ...recording,
              videoUrl: signedUrl // Replace with signed URL
            };
          } catch (error) {
            console.error(`Failed to generate signed URL for ${recording.id}:`, error);
            return recording; // Return original if signing fails
          }
        }
        return recording;
      })
    );
    
    return res.json({
      success: true,
      recordings: recordingsWithSignedUrls
    });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch recordings'
    });
  }
});

/**
 * Get recording by ID with signed URL
 */
router.get('/:recordingId', async (req, res) => {
  try {
    const recording = await prisma.recording.findUnique({
      where: { id: req.params.recordingId },
      include: {
        user: {
          select: { username: true, email: true }
        }
      }
    });
    
    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found'
      });
    }
    
    // Generate signed URL if video exists
    let signedVideoUrl = recording.videoUrl;
    if (recording.videoUrl && recording.status === 'completed') {
      try {
        const s3Key = recording.videoUrl.split('.amazonaws.com/')[1];
        signedVideoUrl = await generateSignedUrl(s3Key, 3600);
      } catch (error) {
        console.error('Failed to generate signed URL:', error);
      }
    }
    
    return res.json({
      success: true,
      recording: {
        ...recording,
        videoUrl: signedVideoUrl // Return signed URL
      }
    });
  } catch (error) {
    console.error('Error fetching recording:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch recording'
    });
  }
});

/**
 * Delete recording
 */
router.delete('/:recordingId', authenticateToken, async (req, res) => {
  try {
    const recording = await prisma.recording.findUnique({
      where: { id: req.params.recordingId }
    });
    
    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found'
      });
    }
    
    // Check ownership
    if (recording.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this recording'
      });
    }
    
    // Delete from database
    await prisma.recording.delete({
      where: { id: req.params.recordingId }
    });
    
    // Optionally delete from S3
    // Uncomment if you want to delete the actual video file
    /*
    if (recording.videoUrl) {
      const s3Key = recording.videoUrl.split('.amazonaws.com/')[1];
      await deleteFromS3(s3Key);
    }
    */
    
    return res.json({
      success: true,
      message: 'Recording deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting recording:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete recording'
    });
  }
});

export default router;
