import { Circle, Square, Loader2 } from 'lucide-react';

function RecordingControls({ 
  isRecording, 
  recordingTime, 
  uploadedChunks,
  onStart, 
  onStop,
  disabled 
}) {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
      {/* Recording Status */}
      <div className="text-center mb-6">
        {isRecording ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-500 font-semibold">RECORDING</span>
            </div>
            <div className="text-3xl font-mono font-bold text-dark-text">
              {formatTime(recordingTime)}
            </div>
            <div className="text-xs text-dark-text-muted">
              {uploadedChunks} chunks uploaded
            </div>
          </div>
        ) : (
          <div className="text-dark-text-muted">
            Ready to record
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-4">
        {!isRecording ? (
          <button
            onClick={onStart}
            disabled={disabled}
            className="btn btn-primary px-8 py-4 text-lg flex items-center space-x-3"
          >
            <Circle className="w-6 h-6" />
            <span>Start Recording</span>
          </button>
        ) : (
          <button
            onClick={onStop}
            className="btn btn-danger px-8 py-4 text-lg flex items-center space-x-3"
          >
            <Square className="w-6 h-6" />
            <span>Stop Recording</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default RecordingControls;
