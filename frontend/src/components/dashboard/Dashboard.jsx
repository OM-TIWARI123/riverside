import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Video as VideoIcon, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import Navbar from '../layout/Navbar';
import RecordingCard from './RecordingCard';
import VideoPlayer from './VideoPlayer';

function Dashboard() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecordings();
  }, []);

  const fetchRecordings = async () => {
    try {
      const response = await api.get('/recordings');
      setRecordings(response.data.recordings);
    } catch (error) {
      toast.error('Failed to load recordings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    setCreatingRoom(true);
    try {
      const response = await api.post('/create-room');
      const { roomId } = response.data;
      toast.success('Room created!');
      navigate(`/room/${roomId}`);
    } catch (error) {
      toast.error('Failed to create room');
      console.error(error);
    } finally {
      setCreatingRoom(false);
    }
  };

  const handlePlay = (recording) => {
    setSelectedRecording(recording);
  };

  const handleDelete = async (recording) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;

    try {
      await api.delete(`/recordings/${recording.id}`);
      setRecordings(recordings.filter(r => r.id !== recording.id));
      toast.success('Recording deleted');
    } catch (error) {
      toast.error('Failed to delete recording');
      console.error(error);
    }
  };

  return (
    <>
      <Navbar />
      
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-dark-text">My Recordings</h1>
              <p className="text-dark-text-muted mt-1">
                {recordings.length} {recordings.length === 1 ? 'recording' : 'recordings'}
              </p>
            </div>
            
            <button
              onClick={createRoom}
              disabled={creatingRoom}
              className="btn btn-primary px-6 py-3 flex items-center space-x-2"
            >
              {creatingRoom ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  <span>New Recording</span>
                </>
              )}
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}

          {/* Empty State */}
          {!loading && recordings.length === 0 && (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-dark-card rounded-full mb-4">
                <VideoIcon className="w-10 h-10 text-dark-text-muted" />
              </div>
              <h2 className="text-2xl font-semibold text-dark-text mb-2">
                No recordings yet
              </h2>
              <p className="text-dark-text-muted mb-6">
                Create your first recording to get started
              </p>
              <button
                onClick={createRoom}
                className="btn btn-primary px-6 py-3"
              >
                Create First Recording
              </button>
            </div>
          )}

          {/* Recordings Grid */}
          {!loading && recordings.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recordings.map((recording) => (
                <RecordingCard
                  key={recording.id}
                  recording={recording}
                  onPlay={handlePlay}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedRecording && (
        <VideoPlayer
          recording={selectedRecording}
          onClose={() => setSelectedRecording(null)}
        />
      )}
    </>
  );
}

export default Dashboard;
