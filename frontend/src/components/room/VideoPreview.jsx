import { useEffect, useRef } from 'react';
import { Video, VideoOff, User } from 'lucide-react';

function VideoPreview({ stream, userName = 'You', isLocal = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative aspect-video bg-dark-bg rounded-xl overflow-hidden border border-dark-border">
      {stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className="w-full h-full object-cover"
          />
          
          {/* User Name Overlay */}
          <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center space-x-2">
            <User className="w-3 h-3 text-white" />
            <p className="text-sm text-white font-medium">
              {userName} {isLocal && '(You)'}
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          {/* Avatar Circle */}
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center">
            <span className="text-3xl text-primary font-bold">
              {userName?.charAt(0).toUpperCase()}
            </span>
          </div>
          
          {/* User Info */}
          <div className="text-center">
            <p className="text-dark-text font-medium mb-1">{userName}</p>
            <div className="flex items-center justify-center space-x-2 text-dark-text-muted text-sm">
              <VideoOff className="w-4 h-4" />
              <span>Camera off</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoPreview;
