import { useState, useEffect, useRef } from 'react';
import { Video, Mic, MicOff, VideoOff, Settings } from 'lucide-react';

function MediaSetup({ onReady, userName }) {
  const [stream, setStream] = useState(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef(null);

  useEffect(() => {
    requestMedia();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const requestMedia = async () => {
    try {
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
      
      setStream(mediaStream);
      setLoading(false);
    } catch (error) {
      console.error('Failed to get media:', error);
      setLoading(false);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(!videoEnabled);
      }
    }
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(!audioEnabled);
      }
    }
  };

  const handleJoin = () => {
    onReady(stream);
  };

  return (
    <div className="fixed inset-0 bg-dark-bg flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="card">
          <h2 className="text-2xl font-bold text-dark-text mb-6 text-center">
            Ready to Join?
          </h2>

          {/* Video Preview */}
          <div className="relative aspect-video bg-dark-bg rounded-xl overflow-hidden mb-6 border border-dark-border">
            {stream && videoEnabled ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <VideoOff className="w-10 h-10 text-primary" />
                  </div>
                  <p className="text-dark-text-muted">
                    {loading ? 'Requesting camera access...' : 'Camera is off'}
                  </p>
                </div>
              </div>
            )}

            {/* User Name Overlay */}
            <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <p className="text-sm text-white font-medium">{userName}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition-all ${
                videoEnabled
                  ? 'bg-dark-hover text-dark-text hover:bg-dark-border'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
              title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>

            <button
              onClick={toggleAudio}
              className={`p-4 rounded-full transition-all ${
                audioEnabled
                  ? 'bg-dark-hover text-dark-text hover:bg-dark-border'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
              title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>
          </div>

          {/* Join Button */}
          <button
            onClick={handleJoin}
            disabled={!stream}
            className="btn btn-primary w-full py-4 text-lg"
          >
            {loading ? 'Setting up...' : 'Join Room'}
          </button>

          {/* Error Message */}
          {!loading && !stream && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500">
                ⚠️ Camera/microphone access denied. Please allow access and refresh the page.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MediaSetup;
