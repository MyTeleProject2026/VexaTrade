// frontend-user/src/pages/auth/LoginPage.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useNotification } from '../../hooks/useNotification';
import { authApi } from '../../services/api';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, LogIn } from 'lucide-react';
// Optional: Google OAuth import if needed
// import { useGoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { showSuccess, showError } = useNotification();

  // // Google OAuth (if you have it)
  // const googleLogin = useGoogleLogin({
  //   onSuccess: async (tokenResponse) => { ... },
  //   onError: () => showError('Google login failed'),
  // });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      showError('Please fill all fields');
      return;
    }
    try {
      setLoading(true);
      const res = await authApi.login({ email, password });

      // ✅ Check success flag from VexaAccount
      if (res.data?.success) {
        const token = res.data.token;
        const user = res.data.user;

        // Store token with VexaTrade keys
        localStorage.setItem('userToken', token);
        localStorage.setItem('token', token);
        localStorage.setItem('accessToken', token);
        if (user) {
          localStorage.setItem('user', JSON.stringify(user));
          localStorage.setItem('userData', JSON.stringify(user));
        }

        showSuccess('Login successful');
        navigate('/dashboard');
      } else {
        // Show the server message (e.g., "Please verify your email")
        const msg = res.data?.message || 'Login failed';
        showError(`❌ ${msg}`);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      showError(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="glass-card max-w-md w-full p-6">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition mb-4">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold gradient-text text-center mb-2">Welcome Back</h1>
        <p className="text-slate-400 text-center text-sm mb-6">Sign in to your trading dashboard</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="email"
                className="input-field pl-10"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
          </div>
          <div>
            <label className="input-label">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field pl-10 pr-12"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="text-right">
            <Link to="/forgot-password" className="text-xs text-cyan-400 hover:underline">
              Forgot Password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 flex justify-center items-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-black/30 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <LogIn size={18} />
            )}
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          Don't have an account? <Link to="/register" className="text-cyan-400 hover:underline">Register</Link>
        </p>

        {/* Optional Google OAuth button */}
        {/* <div className="relative my-6">...</div>
        <button onClick={googleLogin} className="btn-secondary w-full ...">Continue with Google</button> */}
      </div>
    </div>
  );
}
