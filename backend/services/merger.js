import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { uploadToS3 } from './s3.js';
import prisma from '../prisma/client.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function mergeUserChunks(roomId, userId) {
  return new Promise(async (resolve, reject) => {
    const uploadsDir = path.join(__dirname, '..', 'uploads', roomId, userId);
    const outputDir = path.join(__dirname, '..', 'uploads', roomId, 'merged');
    
    fs.mkdirSync(outputDir, { recursive: true });
    
    // 🎯 Look for single complete file
    const videoFile = path.join(uploadsDir, `${userId}.webm`);
    
    console.log(`🔍 Looking for: ${videoFile}`);
    
    if (!fs.existsSync(videoFile)) {
      return reject(new Error(`Video file not found: ${videoFile}`));
    }

    const stats = fs.statSync(videoFile);
    console.log(`🔧 Processing video for user ${userId}`);
    console.log(`📦 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    if (stats.size === 0) {
      return reject(new Error(`Video file is empty`));
    }
    
    const outputFile = path.join(outputDir, `${userId}.mp4`);
    
    try {
      console.log(`🎬 Converting WebM to MP4...`);
      
      // 🎯 Simple conversion - no concatenation needed!
      await execPromise(
        `ffmpeg -y -i "${videoFile}" ` +
        `-c:v libx264 -preset medium -crf 23 ` +
        `-r 30 ` +
        `-c:a aac -ar 48000 -ac 2 -b:a 192k ` +
        `-movflags +faststart ` +
        `"${outputFile}"`
      );
      
      console.log(`✅ Video converted: ${outputFile}`);
      
      const duration = await getVideoDuration(outputFile);
      console.log(`⏱️ Duration: ${duration.toFixed(2)}s`);
      
      resolve(outputFile);
      
    } catch (err) {
      console.error('❌ Conversion error:', err);
      reject(err);
    }
  });
}
// Fallback method: Convert each chunk to intermediate format, then concat
async function twoStepMerge(chunks, uploadsDir, outputFile) {
  console.log('📝 Two-step merge: Converting chunks to intermediate format...');
  
  const tempDir = path.join(uploadsDir, 'temp');
  fs.mkdirSync(tempDir, { recursive: true });
  
  // Step 1: Convert each WebM to intermediate MP4
  const intermediateFiles = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(uploadsDir, chunks[i]);
    const intermediatePath = path.join(tempDir, `intermediate_${i}.mp4`);
    
    console.log(`   Converting chunk ${i}...`);
    
    await execPromise(
      `ffmpeg -y -i "${chunkPath}" ` +
      `-c:v libx264 -preset ultrafast -crf 18 ` +
      `-r 30 ` +
      `-vsync cfr ` +
      `-c:a aac -ar 48000 -ac 2 -b:a 192k ` +
      `-avoid_negative_ts make_zero ` +
      `"${intermediatePath}"`
    );
    
    intermediateFiles.push(`intermediate_${i}.mp4`);
  }
  
  console.log('✅ All chunks converted to intermediate format');
  
  // Step 2: Concatenate intermediate files
  const concatFilePath = path.join(tempDir, 'concat.txt');
  const concatContent = intermediateFiles
    .map(file => `file '${file}'`)
    .join('\n');
  fs.writeFileSync(concatFilePath, concatContent);
  
  console.log('🔗 Concatenating intermediate files...');
  
  await execPromise(
    `ffmpeg -y -f concat -safe 0 -i "${concatFilePath}" ` +
    `-c copy ` +  // Just copy, no re-encoding
    `-movflags +faststart ` +
    `"${outputFile}"`
  );
  
  // Cleanup temp files
  fs.rmSync(tempDir, { recursive: true, force: true });
  
  console.log('✅ Two-step merge completed');
}

export async function mergeSideBySide(roomId, userIds) {
  return new Promise(async (resolve, reject) => {
    const mergedDir = path.join(__dirname, '..', 'uploads', roomId, 'merged');
    const finalOutput = path.join(mergedDir, 'final.mp4');
    
    const video1 = path.join(mergedDir, `${userIds[0]}.mp4`);
    const video2 = path.join(mergedDir, `${userIds[1]}.mp4`);
    
    console.log(`🎬 Creating side-by-side video with duration preservation`);
    
    try {
      // Get actual durations and use the longer one
      const duration1 = await getVideoDuration(video1);
      const duration2 = await getVideoDuration(video2);
      const maxDuration = Math.max(duration1, duration2);
      
      console.log(`⏱️ Video 1: ${duration1.toFixed(2)}s, Video 2: ${duration2.toFixed(2)}s, Using: ${maxDuration.toFixed(2)}s`);
      
      // 🎯 FIXED: Simplified and robust audio merging
      await execPromise(
        `ffmpeg -y -i "${video1}" -i "${video2}" ` +
        `-filter_complex "` +
        `[0:v]scale=960:540:flags=lanczos:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS[v0];` +
        `[1:v]scale=960:540:flags=lanczos:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS[v1];` +
        `[v0][v1]hstack=inputs=2[outv];` +
        `[0:a]aformat=channel_layouts=stereo[a0];` +    // FIX: Explicit stereo format
        `[1:a]aformat=channel_layouts=stereo[a1];` +    // FIX: Explicit stereo format  
        `[a0][a1]amerge=inputs=2,pan=stereo|c0=0.5*c0+0.5*c2|c1=0.5*c1+0.5*c3[outa]` +
        `" ` +
        `-map "[outv]" -map "[outa]" ` +
        `-t ${maxDuration} ` +
        `-r 30 ` +
        `-c:v libx264 -preset medium -crf 18 ` +
        `-c:a aac -ar 48000 -b:a 256k ` +
        `-movflags +faststart ` +
        `-shortest ` +  // Use shortest stream to avoid sync issues
        `"${finalOutput}"`
      );
      
      const finalDuration = await getVideoDuration(finalOutput);
      console.log(`✅ Final video created: ${finalOutput} (${finalDuration.toFixed(2)}s)`);
      resolve(finalOutput);
      
    } catch (err) {
      console.error('❌ Side-by-side merge error:', err);
      reject(err);
    }
  });
}

export async function processRoom(roomId, userIds) {
  console.log(`🚀 Starting processing for room ${roomId}`);
  
  try {
    // Step 1: Merge individual user chunks with DURATION FIX
    const userVideos = [];
    for (const userId of userIds) {
      console.log(`🔧 Merging chunks for user ${userId}`);
      const videoPath = await mergeUserChunks(roomId, userId);
      
      // Verify each user video duration
      const duration = await getVideoDuration(videoPath);
      console.log(`⏱️ User ${userId} video duration: ${duration.toFixed(2)}s`);
      
      userVideos.push(videoPath);
    }
    
    // Step 2: Merge side-by-side if multiple users
    let finalVideoPath;
    if (userIds.length === 2) {
      console.log(`🎬 Creating side-by-side video`);
      finalVideoPath = await mergeSideBySide(roomId, userIds);
    } else if (userIds.length === 1) {
      finalVideoPath = userVideos[0];
    } else {
      throw new Error('Unsupported number of users for merging');
    }
    
    // Verify final duration
    const finalDuration = await getVideoDuration(finalVideoPath);
    console.log(`✅ Final video created: ${finalVideoPath} (${finalDuration.toFixed(2)}s)`);
    
    // Rest of your existing processRoom code remains the same...
    const timestamp = Date.now();
    const s3Key = `recordings/${roomId}/final-${timestamp}.mp4`;
    
    console.log(`📤 Uploading to S3: ${s3Key}`);
    const stats = fs.statSync(finalVideoPath);
    console.log(`📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    const s3Url = await uploadToS3(finalVideoPath, s3Key, 'video/mp4');
    
    const recording = await prisma.recording.update({
      where: { roomId },
      data: {
        videoUrl: s3Url,
        status: 'completed',
        duration: Math.round(finalDuration),
      },
    });
    
    console.log(`✅ Recording updated in database`);
    console.log(`🔗 Video URL: ${s3Url}`);
    
    if (process.env.NODE_ENV === 'production') {
      const uploadDir = path.join(__dirname, '..', 'uploads', roomId);
      fs.rmSync(uploadDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up local files`);
    }
    
    return recording;
  } catch (error) {
    console.error('❌ Processing error:', error);
    
    try {
      await prisma.recording.update({
        where: { roomId },
        data: { status: 'failed' },
      });
    } catch (dbError) {
      console.error('Failed to update recording status:', dbError);
    }
    
    throw error;
  }
}

function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error('Error getting video duration:', err);
        reject(err);
      } else {
        const duration = metadata.format.duration || 0;
        resolve(duration);
      }
    });
  });
}