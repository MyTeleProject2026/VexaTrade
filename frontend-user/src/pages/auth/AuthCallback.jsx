import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 1. Parse the URL parameters
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const userParam = params.get('user');
    const error = params.get('error');

    // 2. Handle errors from VexaAccount (e.g., user cancelled)
    if (error) {
      console.error('❌ Auth error from VexaAccount:', error);
      navigate('/login?error=auth_failed', { replace: true });
      return;
    }

    // 3. Check if token exists
    if (token) {
      // 4. Save token to localStorage
      localStorage.setItem('token', token);

      // 5. Save user info if provided (usually a JSON string)
      if (userParam) {
        localStorage.setItem('user', userParam);
        console.log('👤 User info saved');
      }

      console.log('✅ Token saved successfully');

      // 6. (Security) Remove the token from the URL to prevent exposure
      //    This replaces the URL with the clean path (no ?token=...)
      window.history.replaceState({}, document.title, window.location.pathname);

      // 7. Redirect to the account verification page (or dashboard)
      navigate('/account-verification', { replace: true });
    } else {
      // 8. No token – authentication failed
      console.error('❌ No token in callback URL');
      navigate('/login?error=missing_token', { replace: true });
    }
  }, [location, navigate]);

  // Show a loading message while processing
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}
    >
      <p>Completing login... Please wait.</p>
    </div>
  );
};

export default AuthCallback;
