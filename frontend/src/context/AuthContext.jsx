import { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
    } catch (error) {
        console.log(error)
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('authToken', token);
      setToken(token);
      setUser(user);
      
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
      throw error;
    }
  };

  const signup = async (username, email, password) => {
    try {
      const response = await api.post('/auth/signup', { username, email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('authToken', token);
      setToken(token);
      setUser(user);
      
      toast.success('Account created!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Signup failed');
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
    navigate('/login');
    toast.success('Logged out');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Export context separately
export { AuthContext };
