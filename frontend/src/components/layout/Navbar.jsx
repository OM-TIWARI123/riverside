import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Video, LogOut, User, ChevronDown } from 'lucide-react';

function Navbar() {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-dark-card border-b border-dark-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-xl">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-dark-text">Riverside</span>
          </Link>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-dark-hover transition-colors"
            >
              <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-full">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm text-dark-text font-medium">
                {user?.username}
              </span>
              <ChevronDown className="w-4 h-4 text-dark-text-muted" />
            </button>

            {/* Dropdown */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-dark-card rounded-lg shadow-lg border border-dark-border py-1 z-50">
                <div className="px-4 py-2 border-b border-dark-border">
                  <p className="text-xs text-dark-text-muted">Signed in as</p>
                  <p className="text-sm text-dark-text font-medium truncate">
                    {user?.email}
                  </p>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm text-dark-text hover:bg-dark-hover flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
