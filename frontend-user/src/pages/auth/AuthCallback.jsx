import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const userParam = params.get('user');
    const error = params.get('error');

    if (error) {
      console.error('❌ Auth error:', error);
      navigate('/login?error=auth_failed', { replace: true });
      return;
    }

    if (token) {
      // ✅ Save token to ALL keys used by api.js
      localStorage.setItem('token', token);
      localStorage.setItem('userToken', token);
      localStorage.setItem('accessToken', token);

      if (userParam) {
        localStorage.setItem('user', userParam);
        localStorage.setItem('userData', userParam);
      }

      console.log('✅ Token saved to localStorage');

      // Remove token from URL for security
      window.history.replaceState({}, document.title, window.location.pathname);

      // ✅ Navigate to verification page
      navigate('/account-verification', { replace: true });
    } else {
      console.error('❌ No token in callback URL');
      navigate('/login?error=missing_token', { replace: true });
    }
  }, [location, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050812]">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        <p className="mt-4 text-sm text-slate-400">Completing login…</p>
      </div>
    </div>
  );
};

export default AuthCallback;
