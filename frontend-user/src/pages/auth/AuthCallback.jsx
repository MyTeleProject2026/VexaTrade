import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { exchangeVexaAccountCode, getVexaAccountUser } from '../../services/vexaAccountSso';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    async function complete() {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');
      const userParam = params.get('user');
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');

      if (error) {
        console.error('❌ Auth error:', error);
        navigate('/login?error=auth_failed', { replace: true });
        return;
      }

      try {
        if (code) {
          const tokens = await exchangeVexaAccountCode(code, state);
          const identity = await getVexaAccountUser(tokens.access_token);
          const localToken = tokens.access_token;
          localStorage.setItem('token', localToken);
          localStorage.setItem('userToken', localToken);
          localStorage.setItem('accessToken', localToken);
          localStorage.setItem('vexaAccountRefreshToken', tokens.refresh_token || '');
          localStorage.setItem('user', JSON.stringify(identity));
          localStorage.setItem('userData', JSON.stringify(identity));
          if (!cancelled) {
            window.history.replaceState({}, document.title, window.location.pathname);
            navigate('/account-verification', { replace: true });
          }
          return;
        }

        // Preserve the existing callback/token flow for compatibility.
        if (token) {
          localStorage.setItem('token', token);
          localStorage.setItem('userToken', token);
          localStorage.setItem('accessToken', token);
          if (userParam) {
            localStorage.setItem('user', userParam);
            localStorage.setItem('userData', userParam);
          }
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate('/account-verification', { replace: true });
          return;
        }

        navigate('/login?error=missing_token', { replace: true });
      } catch (err) {
        console.error('❌ VexaAccount SSO error:', err);
        if (!cancelled) navigate('/login?error=sso_failed', { replace: true });
      }
    }
    complete();
    return () => { cancelled = true; };
  }, [location, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050812]">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        <p className="mt-4 text-sm text-slate-400">Completing VexaAccount sign-in…</p>
      </div>
    </div>
  );
};

export default AuthCallback;
