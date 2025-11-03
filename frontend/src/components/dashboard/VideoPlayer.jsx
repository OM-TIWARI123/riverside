import { X, Download } from 'lucide-react';
import { useEffect } from 'react';

function VideoPlayer({ recording, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-dark-card rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-dark-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <div>
            <h2 className="text-lg font-semibold text-dark-text">{recording.title}</h2>
            <p className="text-sm text-dark-text-muted">
              {recording.duration && `${Math.floor(recording.duration / 60)}:${(recording.duration % 60).toString().padStart(2, '0')}`}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <a
              href={recording.videoUrl}
              download
              className="btn btn-secondary p-2"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </a>
            
            <button
              onClick={onClose}
              className="btn btn-secondary p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="bg-black">
          <video
            src={recording.videoUrl}
            controls
            autoPlay
            className="w-full max-h-[70vh]"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
