import { useState, useRef } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

export function useRecorder(roomId, userId) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // 🎯 High quality settings - NO COMPROMISE
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 5000000, // 5 Mbps - HIGH QUALITY
        audioBitsPerSecond: 256000   // 256 kbps - Studio quality
      });

      mediaRecorderRef.current = mediaRecorder;

      // Collect all chunks in memory
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log(`📦 Chunk collected: ${(event.data.size / 1024 / 1024).toFixed(2)} MB`);
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        toast.error('Recording error occurred');
      };

      // Record everything as one complete file
      mediaRecorder.start();
      
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      console.log('✅ Recording started (HIGH QUALITY)');
      toast.success('Recording started!');
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to access camera/microphone');
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;

      mediaRecorder.onstop = async () => {
        console.log(`✅ Recording stopped. Chunks: ${chunksRef.current.length}`);
        
        // Stop stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Create complete video blob
        const completeBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        console.log(`📹 Complete video: ${(completeBlob.size / 1024 / 1024).toFixed(2)} MB`);

        // 🎯 Upload in chunks for better UX
        await uploadVideoInChunks(completeBlob);

        setIsRecording(false);
        setRecordingTime(0);
        toast.success('Recording uploaded!');
        
        resolve();
      };

      mediaRecorder.stop();
    });
  };

  // 🎯 NEW: Split large video into chunks and upload in parallel
  const uploadVideoInChunks = async (completeBlob) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
      const totalChunks = Math.ceil(completeBlob.size / CHUNK_SIZE);
      
      console.log(`📤 Uploading video in ${totalChunks} chunks...`);

      // Step 1: Initialize upload session
      const { data: sessionData } = await api.post('/upload/init-session', {
        roomId,
        userId,
        totalSize: completeBlob.size,
        totalChunks
      });

      const { sessionId } = sessionData;
      console.log(`✅ Upload session created: ${sessionId}`);

      // Step 2: Upload chunks in parallel (batches of 3)
      const uploadPromises = [];
      let uploadedChunks = 0;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, completeBlob.size);
        const chunk = completeBlob.slice(start, end);

        const uploadPromise = uploadChunk(sessionId, chunk, i, totalChunks)
          .then(() => {
            uploadedChunks++;
            const progress = Math.round((uploadedChunks / totalChunks) * 100);
            setUploadProgress(progress);
            console.log(`📊 Progress: ${progress}% (${uploadedChunks}/${totalChunks})`);
          });

        uploadPromises.push(uploadPromise);

        // Upload in batches of 3 to avoid overwhelming the server
        if (uploadPromises.length === 3 || i === totalChunks - 1) {
          await Promise.all(uploadPromises);
          uploadPromises.length = 0; // Clear array
        }
      }

      // Step 3: Finalize upload
      console.log(`🔗 Finalizing upload...`);
      await api.post('/upload/finalize-session', {
        sessionId,
        roomId,
        userId
      });

      console.log(`✅ Upload complete!`);
      setIsUploading(false);
      
    } catch (error) {
      console.error('Failed to upload video:', error);
      setIsUploading(false);
      toast.error('Failed to upload recording');
      throw error;
    }
  };



const uploadChunk = async (sessionId, chunk, chunkIndex, totalChunks) => {
  const formData = new FormData();
  formData.append('chunk', chunk, `chunk_${chunkIndex}.webm`);

  
  await api.post(
    `/upload/chunk?sessionId=${sessionId}&chunkIndex=${chunkIndex}&totalChunks=${totalChunks}`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    }
  );
};

  return {
    isRecording,
    recordingTime,
    uploadProgress,
    isUploading,
    startRecording,
    stopRecording,
    stream: streamRef.current
  };
}