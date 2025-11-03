import { useState } from 'react';
import { User } from 'lucide-react';

function GuestNamePrompt({ onSubmit }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-dark-text mb-2">
            Join Recording Room
          </h2>
          <p className="text-dark-text-muted">
            Please enter your name to continue
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="label">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="John Doe"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="btn btn-primary w-full py-3"
          >
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
}

export default GuestNamePrompt;
