import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://vexatrade-5ycu.onrender.com';

const isFullyApproved = (user) =>
  Number(user?.email_verified || 0) === 1 &&
  String(user?.kyc_status || '').toLowerCase() === 'approved' &&
  String(user?.status || '').toLowerCase() === 'active';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState('Completing login…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');
      const expected = sessionStorage.getItem('vexa_sso_state');
      sessionStorage.removeItem('vexa_sso_state');

      if (error) { navigate('/login?error=auth_failed', { replace: true }); return; }
      if (!code || !state || !expected || state !== expected) {
        navigate('/login?error=invalid_sso_state', { replace: true });
        return;
      }

      try {
        setMessage('Verifying your VexaAccount securely…');
        const response = await fetch(`${API_BASE_URL}/api/auth/vexaaccount/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code, state }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'VexaAccount login failed');
        if (cancelled) return;

        localStorage.setItem('token', data.token);
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('accessToken', data.token);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('userData', JSON.stringify(data.user));
        }

        // Resolve access from the authoritative VexaTrade API once after SSO.
        // This prevents a stale callback payload or cached browser state from
        // sending an already-approved account through the verification screen.
        setMessage('Checking your VexaTrade account access…');
        let destination = isFullyApproved(data.user) ? '/dashboard' : '/account-verification';
        try {
          const statusResponse = await fetch(`${API_BASE_URL}/api/auth/verification-status`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${data.token}` },
            credentials: 'include',
          });
          const statusData = await statusResponse.json();
          if (statusResponse.ok && statusData?.success && statusData?.status) {
            const status = statusData.status;
            const approved = status.emailVerified === true &&
              String(status.kycStatus || '').toLowerCase() === 'approved' &&
              String(status.accountStatus || '').toLowerCase() === 'active';
            destination = approved ? '/dashboard' : '/account-verification';

            const currentUser = data.user || {};
            const reconciledUser = {
              ...currentUser,
              email_verified: status.emailVerified ? 1 : 0,
              kyc_status: status.kycStatus || currentUser.kyc_status || 'not_submitted',
              status: status.accountStatus || currentUser.status || 'pending',
              platform_access: status.platformAccess || (approved ? 'active' : 'locked'),
            };
            localStorage.setItem('user', JSON.stringify(reconciledUser));
            localStorage.setItem('userData', JSON.stringify(reconciledUser));
          }
        } catch (statusError) {
          // Keep the callback result as a safe fallback. A transient status
          // check failure must not destroy a valid authenticated session.
          console.warn('VexaTrade verification status check after SSO failed:', statusError);
        }

        if (cancelled) return;
        window.history.replaceState({}, document.title, window.location.pathname);
        navigate(destination, { replace: true });
      } catch (err) {
        console.error('VexaAccount callback:', err);
        if (!cancelled) navigate('/login?error=auth_failed', { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [location.search, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050812] text-white">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        <p className="mt-4 text-sm text-slate-400">{message}</p>
      </div>
    </div>
  );
};
export default AuthCallback;
