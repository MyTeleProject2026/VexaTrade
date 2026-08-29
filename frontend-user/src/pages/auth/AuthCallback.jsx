import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://vexatrade-5ycu.onrender.com';

const AuthCallback = () => {
  const navigate = useNavigate(); const location = useLocation(); const [message,setMessage]=useState('Completing login…');
  useEffect(() => {
    let cancelled=false;
    (async()=>{
      const params=new URLSearchParams(location.search); const code=params.get('code'); const state=params.get('state'); const error=params.get('error');
      const expected=sessionStorage.getItem('vexa_sso_state');
      sessionStorage.removeItem('vexa_sso_state');
      if(error){navigate('/login?error=auth_failed',{replace:true});return;}
      if(!code||!state||!expected||state!==expected){navigate('/login?error=invalid_sso_state',{replace:true});return;}
      try{
        setMessage('Verifying your VexaAccount securely…');
        const response=await fetch(`${API_BASE_URL}/api/auth/vexaaccount/callback`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({code,state})});
        const data=await response.json(); if(!response.ok||!data.success)throw new Error(data.message||'VexaAccount login failed');
        if(cancelled)return;
        localStorage.setItem('token',data.token);localStorage.setItem('userToken',data.token);localStorage.setItem('accessToken',data.token);
        if(data.user){localStorage.setItem('user',JSON.stringify(data.user));localStorage.setItem('userData',JSON.stringify(data.user));}
        window.history.replaceState({},document.title,window.location.pathname);navigate('/account-verification',{replace:true});
      }catch(err){console.error('VexaAccount callback:',err);navigate('/login?error=auth_failed',{replace:true});}
    })(); return ()=>{cancelled=true};
  },[location.search,navigate]);
  return <div className="flex min-h-screen items-center justify-center bg-[#050812] text-white"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"/><p className="mt-4 text-sm text-slate-400">{message}</p></div></div>;
};
export default AuthCallback;
