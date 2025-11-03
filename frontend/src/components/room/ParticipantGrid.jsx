import VideoPreview from './VideoPreview';

function ParticipantGrid({ localStream, localUserName, participants, remoteStreams, isRecording }) {
  const totalParticipants = participants.length + 1;

  const getGridClass = () => {
    if (totalParticipants === 1) return 'grid-cols-1';
    if (totalParticipants === 2) return 'grid-cols-2';
    if (totalParticipants <= 4) return 'grid-cols-2';
    return 'grid-cols-3';
  };

  return (
    <div className={`grid ${getGridClass()} gap-4`}>
      {/* Local User Video */}
      <div className="relative">
        <VideoPreview 
          stream={localStream} 
          userName={localUserName}
          isLocal={true}
        />
        {isRecording && (
          <div className="absolute top-4 right-4 flex items-center space-x-2 bg-red-500 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-xs text-white font-semibold">REC</span>
          </div>
        )}
      </div>

      {/* Remote Participants - NOW WITH LIVE VIDEO */}
      {participants.map((participant) => (
        <div key={participant.socketId} className="relative">
          <VideoPreview 
            stream={remoteStreams[participant.socketId]} 
            userName={participant.userName}
            isLocal={false}
          />
          {isRecording && (
            <div className="absolute top-4 right-4 flex items-center space-x-2 bg-red-500/80 px-2 py-1 rounded-full">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              <span className="text-xs text-white font-semibold">REC</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ParticipantGrid;
