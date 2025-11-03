import { useState, useRef } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

export function useRecorder(roomId, userId) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      // Get user media
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

      // 🎯 Use MediaRecorder WITHOUT timeslice
      // This creates ONE complete, valid video file
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000
      });

      mediaRecorderRef.current = mediaRecorder;

      // 🎯 Collect ALL data chunks in memory
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log(`📦 Chunk collected: ${event.data.size} bytes`);
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        toast.error('Recording error occurred');
      };

      // 🎯 NO timeslice - record everything as one file
      mediaRecorder.start();
      
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      console.log('✅ Recording started');
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

      // 🎯 When stopped, create final blob and upload
      mediaRecorder.onstop = async () => {
        console.log(`✅ Recording stopped. Chunks collected: ${chunksRef.current.length}`);
        
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

        // 🎯 Create single complete video file from all chunks
        const completeBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        console.log(`📹 Complete video size: ${(completeBlob.size / 1024 / 1024).toFixed(2)} MB`);

        // Upload the complete file
        await uploadCompleteVideo(completeBlob);

        setIsRecording(false);
        setRecordingTime(0);
        toast.success('Recording uploaded!');
        
        resolve();
      };

      // Stop recording
      mediaRecorder.stop();
    });
  };

  const uploadCompleteVideo = async (blob) => {
    try {
      setUploadProgress(0);
      
      const formData = new FormData();
      formData.append('video', blob, `${userId}.webm`);

      console.log(`📤 Uploading complete video...`);

      await api.post(
        `/upload/complete?roomId=${roomId}&userId=${userId}&userName=user`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
            console.log(`📊 Upload progress: ${percentCompleted}%`);
          }
        }
      );

      console.log(`✅ Video uploaded successfully`);
      
    } catch (error) {
      console.error('Failed to upload video:', error);
      toast.error('Failed to upload recording');
      throw error;
    }
  };

  return {
    isRecording,
    recordingTime,
    uploadProgress,
    startRecording,
    stopRecording,
    stream: streamRef.current
  };
}