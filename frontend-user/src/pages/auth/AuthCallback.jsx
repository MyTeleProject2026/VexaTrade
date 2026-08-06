import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotification } from '../hooks/useNotification';

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const user = params.get('user');

    if (token && user) {
      localStorage.setItem('vexastore_user_token', token);
      localStorage.setItem('vexastore_user', user);
      showSuccess('Login successful');
      navigate('/');
    } else {
      showError('Authentication failed');
      navigate('/login');
    }
  }, [location, navigate, showSuccess, showError]);

  return <div className="flex justify-center py-20">Completing login...</div>;
}
