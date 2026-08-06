// frontend-user/src/pages/auth/RegisterPage.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useNotification } from '../../hooks/useNotification';
import { authApi } from '../../services/api';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, CheckCircle, Shield, Send } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { showSuccess, showError, showInfo } = useNotification();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // --- Step 1: Register ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      showError('Please fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      const res = await authApi.register({ name, email, password });
      if (res.data?.success) {
        showSuccess('Account created! Please verify your email with the OTP sent.');
        setStep(2);
      }
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || 'Registration failed';

      // ✅ If 409 means account exists but unverified → resend OTP and go to step 2
      if (status === 409 && err.response?.data?.action === 'verify') {
        showInfo('New OTP sent to your email. Please verify.');
        setStep(2);
        return;
      }
      if (status === 409) {
        showError('Email already registered. Please login instead.');
      } else if (status === 500) {
        showError('Server error. Please try again later.');
      } else {
        showError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Step 2: Verify OTP ---
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      showError('Please enter a valid 6-digit OTP');
      return;
    }
    try {
      setLoading(true);
      const res = await authApi.verifyOtp({ email, otp });
      if (res.data?.success) {
        showSuccess('Email verified successfully! You can now login.');
        navigate('/login');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification failed';
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setResending(true);
      const res = await authApi.resendOtp({ email });
      if (res.data?.success) {
        showSuccess('OTP resent to your email.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to resend OTP';
      showError(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="glass-card max-w-md w-full p-6 relative overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${step >= 1 ? 'bg-cyan-400' : 'bg-slate-600'}`} />
            <div className={`w-2 h-2 rounded-full ${step >= 2 ? 'bg-cyan-400' : 'bg-slate-600'}`} />
            <span className="text-xs text-slate-500 ml-1">Step {step} of 2</span>
          </div>
        </div>

        {step === 1 ? (
          <>
            <h1 className="text-2xl font-bold gradient-text text-center mb-2">Create Account</h1>
            <p className="text-slate-400 text-center text-sm mb-6">Join VexaTrade and start trading</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="input-label">Full Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    className="input-field pl-10"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>
              </div>
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
                    placeholder="Min 6 characters"
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
              <div>
                <label className="input-label">Confirm Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field pl-10"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 flex justify-center items-center gap-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-black/30 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Shield size={18} />
                )}
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </form>
            <p className="mt-4 text-center text-sm text-slate-400">
              Already have an account? <Link to="/login" className="text-cyan-400 hover:underline">Sign In</Link>
            </p>
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-3">
                <Mail size={28} className="text-cyan-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Verify Your Email</h1>
              <p className="text-slate-400 text-sm mt-1">
                We sent a 6-digit code to <span className="text-white font-medium">{email}</span>
              </p>
              <p className="text-slate-500 text-xs mt-1">Check your inbox or spam folder</p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="input-label text-center block">Enter OTP</label>
                <input
                  type="text"
                  maxLength="6"
                  className="input-field text-center text-2xl tracking-widest"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 py-3 flex justify-center items-center gap-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-black/30 border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <CheckCircle size={18} />
                  )}
                  {loading ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={handleResendOtp}
                disabled={resending}
                className="text-sm text-cyan-400 hover:underline disabled:opacity-50"
              >
                {resending ? 'Sending...' : 'Resend OTP'}
              </button>
              <span className="text-xs text-slate-500 ml-2">(expires in 10 min)</span>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              Didn't receive the code? Check your spam folder.
              <br />
              <span className="text-slate-600">If you still don't see it, try resending.</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
