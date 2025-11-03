import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Copy, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useRecorder } from '../../hooks/useRecorder';
import { initializeSocket, disconnectSocket } from '../../services/socket';
import ParticipantGrid from './ParticipantGrid';
import RecordingControls from './RecordingControls';
import ProcessingStatus from './ProcessingStatus';
import GuestNamePrompt from './GuestNamePrompt';
import { useWebRTC } from '../../hooks/useWebRTC';

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  // Handle auth - may be null for guests
  let user = null;
  let token = null;
  
  try {
    const authContext = useAuth();
    user = authContext.user;
    token = authContext.token;
  } catch (error) {
    console.log('Guest user detected');
  }
  
  // State
  const [stream, setStream] = useState(null);
  const [socket, setSocket] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [guestName, setGuestName] = useState(null);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  
  // Refs to prevent double setup
  const setupRef = useRef(false);
  
  // Computed values
  const isGuest = !user || !token;
  const currentUserId = user?.id || `guest-${Date.now()}`;
  const currentUserName = isGuest ? guestName : user?.username;
  
  // Recording hook
  const recorder = useRecorder(roomId, currentUserId);
  
  // WebRTC hook for live video streaming
  const { remoteStreams } = useWebRTC(roomId, stream, socket);

  // Setup effect
  useEffect(() => {
    // Prevent multiple setups
    if (setupRef.current) return;
    
    if (isGuest && !guestName) {
      setShowGuestPrompt(true);
    } else if (currentUserName && !setupRef.current) {
      setupRef.current = true;
      setupRoom();
    }
    
    return () => {
      cleanup();
    };
  }, [guestName, currentUserName]);

  // Guest name handler
  const handleGuestNameSubmit = (name) => {
    setGuestName(name);
    setShowGuestPrompt(false);
  };

  // Setup room with socket and camera
  const setupRoom = async () => {
    try {
      console.log('🎬 Setting up room:', roomId);
      console.log('   User:', currentUserName, '(', isGuest ? 'Guest' : 'Auth', ')');
      
      // Request camera first
      await startCamera();
      
      // Setup socket
      const socketInstance = initializeSocket(token, currentUserName);
      
      // Wait for socket to connect
      socketInstance.on('connect', () => {
        console.log('✅ Socket connected, setting state');
        setSocket(socketInstance);
      });
      
      socketInstance.emit('join-room', {
        roomId,
        userName: currentUserName
      });

      socketInstance.on('user-joined', ({ socketId, userName }) => {
        console.log('👤 User joined:', userName);
        toast.success(`${userName} joined the room`);
      });

      socketInstance.on('user-left', ({ userName }) => {
        console.log('👋 User left:', userName);
        toast(`${userName} left the room`);
      });

      socketInstance.on('room-participants', (participantsList) => {
        console.log('👥 Participants updated:', participantsList.length);
        // Remove duplicates by socketId
        console.log('👥 My socket ID:', socketInstance.id);
        console.log('👥 Am I in the list?', participantsList.some(p => p.socketId === socketInstance.id));
        const uniqueParticipants = participantsList.filter((participant, index, self) =>
          index === self.findIndex(p => p.socketId === participant.socketId)
        );
        setParticipants(uniqueParticipants);
      });

      socketInstance.on('recording-start-sync', () => {
        console.log('🔴 Recording started');
      });

      socketInstance.on('recording-stop-sync', () => {
        setIsProcessing(true);
      });

      socketInstance.on('video-ready', ({ downloadUrl, recordingId }) => {
        setIsProcessing(false);
        setProcessingComplete(true);
        toast.success('Recording is ready!');
        
        setTimeout(() => {
          if (!isGuest) {
            navigate('/dashboard');
          }
        }, 3000);
      });

      socketInstance.on('video-error', ({ error }) => {
        setIsProcessing(false);
        toast.error(`Processing failed: ${error}`);
      });

    } catch (error) {
      console.error('Failed to setup room:', error);
      toast.error('Failed to setup room');
      setupRef.current = false; // Reset on error
    }
  };

  // Request camera access
  const startCamera = async () => {
    try {
      console.log('📷 Requesting camera and microphone access...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
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
      
      console.log('✅ Camera access granted');
      setStream(mediaStream);
      toast.success('Camera and microphone connected');
      
    } catch (error) {
      console.error('❌ Failed to get media:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Camera/microphone permission denied');
      } else if (error.name === 'NotFoundError') {
        toast.error('No camera or microphone found');
      } else {
        toast.error('Failed to access camera/microphone');
      }
    }
  };

  // Cleanup
  const cleanup = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    disconnectSocket();
    setupRef.current = false;
  };

  // Recording controls
  const handleStartRecording = async () => {
    if (isGuest) {
      toast.error('Please sign in to start recording');
      return;
    }
    
    if (!socket) {
      toast.error('Socket not connected');
      return;
    }
    
    socket.emit('start-recording', { roomId });
    await recorder.startRecording();
  };

  const handleStopRecording = async () => {
    if (!socket) {
      toast.error('Socket not connected');
      return;
    }
    
    await recorder.stopRecording();
    socket.emit('stop-recording', { roomId });
  };

  // Copy room link
  const copyRoomLink = () => {
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Room link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Back navigation
  const handleBackClick = () => {
    if (isGuest) {
      navigate('/login');
    } else {
      navigate('/dashboard');
    }
  };

  // Show guest prompt if needed
  if (showGuestPrompt) {
    return <GuestNamePrompt onSubmit={handleGuestNameSubmit} />;
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-dark-card border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackClick}
                className="btn btn-secondary flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{isGuest ? 'Sign In' : 'Dashboard'}</span>
              </button>
              
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-dark-text">
                  Room: {roomId}
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {isGuest && (
                <div className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <span className="text-sm text-yellow-500 font-medium">
                    Guest
                  </span>
                </div>
              )}

              <div className="flex items-center space-x-2 px-3 py-2 bg-dark-bg rounded-lg">
                <Users className="w-5 h-5 text-dark-text-muted" />
                <span className="text-dark-text font-medium">
                  {participants.length + 1}
                </span>
              </div>

              <button
                onClick={copyRoomLink}
                className="btn btn-secondary flex items-center space-x-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span className="hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="hidden sm:inline">Invite</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Participant Grid - WITH WEBRTC STREAMS */}
        <div className="mb-6">
          <ParticipantGrid
            localStream={recorder.stream || stream}
            localUserName={currentUserName || 'Loading...'}
            participants={participants}
            remoteStreams={remoteStreams}
            isRecording={recorder.isRecording}
          />
        </div>

        {/* Controls Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recording Controls */}
          <div className="lg:col-span-2">
            <RecordingControls
              isRecording={recorder.isRecording}
              recordingTime={recorder.recordingTime}
              uploadedChunks={recorder.uploadedChunks}
              onStart={handleStartRecording}
              onStop={handleStopRecording}
              disabled={!stream || isGuest}
            />

            {/* Guest Warning */}
            {isGuest && (
              <div className="card bg-yellow-500/5 border-yellow-500/20 mt-4">
                <div className="space-y-3">
                  <p className="text-sm text-yellow-500">
                    ⚠️ Guest users can view but cannot record.
                  </p>
                  <button 
                    onClick={() => navigate('/login')}
                    className="btn btn-primary w-full"
                  >
                    Sign In to Record
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Participants Sidebar */}
          <div>
            <div className="card">
              <h3 className="text-lg font-semibold text-dark-text mb-4">
                Participants ({participants.length + 1})
              </h3>
              
              <div className="space-y-3">
                {/* Local User */}
                <div className="flex items-center space-x-3 p-2 bg-dark-bg rounded-lg">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-sm text-white font-semibold">
                      {currentUserName?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-dark-text font-medium">
                      {currentUserName} (You)
                    </p>
                    <p className="text-xs text-dark-text-muted">
                      {isGuest ? 'Guest' : 'Host'}
                    </p>
                  </div>
                </div>

                {/* Remote Participants */}
                {participants.map((participant) => (
                  <div 
                    key={participant.socketId}
                    className="flex items-center space-x-3 p-2 bg-dark-bg rounded-lg"
                  >
                    <div className="w-8 h-8 bg-primary/50 rounded-full flex items-center justify-center">
                      <span className="text-sm text-white font-semibold">
                        {participant.userName?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-dark-text font-medium">
                        {participant.userName}
                      </p>
                      <p className="text-xs text-dark-text-muted">
                        {participant.isGuest ? 'Guest' : 'Participant'}
                      </p>
                    </div>
                  </div>
                ))}

                {participants.length === 0 && (
                  <p className="text-sm text-dark-text-muted text-center py-4">
                    Waiting for others to join...
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Processing Status */}
        {(isProcessing || processingComplete) && (
          <div className="mt-6">
            <ProcessingStatus 
              isProcessing={isProcessing}
              isComplete={processingComplete}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default Room;
