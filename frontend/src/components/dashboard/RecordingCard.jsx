import { Play, Download, Trash2, Clock, Calendar,Video } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function RecordingCard({ recording, onPlay, onDelete }) {
  const getStatusBadge = (status) => {
    const badges = {
      completed: 'bg-green-500/10 text-green-500',
      processing: 'bg-yellow-500/10 text-yellow-500',
      failed: 'bg-red-500/10 text-red-500',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status] || badges.processing}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="card hover:border-dark-hover transition-all group">
      {/* Thumbnail Placeholder */}
      <div className="aspect-video bg-dark-bg rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
        <Video className="w-12 h-12 text-dark-text-muted" />
        
        {/* Play Button Overlay */}
        {recording.status === 'completed' && (
          <button
            onClick={() => onPlay(recording)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center hover:scale-110 transition-transform">
              <Play className="w-6 h-6 text-white ml-1" />
            </div>
          </button>
        )}
        
        {/* Duration Badge */}
        {recording.duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>{formatDuration(recording.duration)}</span>
          </div>
        )}
      </div>

      {/* Recording Info */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-dark-text line-clamp-1">
            {recording.title}
          </h3>
          <div className="flex items-center space-x-2 mt-1 text-xs text-dark-text-muted">
            <Calendar className="w-3 h-3" />
            <span>{formatDistanceToNow(new Date(recording.createdAt), { addSuffix: true })}</span>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {getStatusBadge(recording.status)}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 pt-2 border-t border-dark-border">
          {recording.status === 'completed' && (
            <>
              <button
                onClick={() => onPlay(recording)}
                className="flex-1 btn btn-secondary py-2 text-sm flex items-center justify-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>Play</span>
              </button>
              
              <a
                href={recording.videoUrl}
                download
                className="btn btn-secondary p-2"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
            </>
          )}
          
          <button
            onClick={() => onDelete(recording)}
            className="btn btn-secondary p-2 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecordingCard;
