// frontend-user/src/pages/auth/ForgotPasswordPage.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useNotification } from '../../hooks/useNotification';
import { authApi } from '../../services/api';
import { Mail, ArrowLeft, Send } from 'lucide-react';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { showSuccess, showError } = useNotification();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      showError('Please enter your email');
      return;
    }
    try {
      setLoading(true);
      const res = await authApi.forgotPassword({ email });
      if (res.data?.success) {
        setSubmitted(true);
        showSuccess('If your email is registered, you will receive a reset link.');
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="glass-card max-w-md w-full p-6">
        <button onClick={() => navigate('/login')} className="text-slate-400 hover:text-white transition mb-4">
          <ArrowLeft size={20} />
        </button>

        {submitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <Mail size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Check Your Email</h2>
            <p className="text-slate-400 text-sm">
              We sent a password reset link to <span className="text-white font-medium">{email}</span>
            </p>
            <p className="text-slate-500 text-xs mt-2">The link expires in 1 hour.</p>
            <Link to="/login" className="text-cyan-400 hover:underline mt-4 inline-block">Back to Login</Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold gradient-text text-center mb-2">Forgot Password</h1>
            <p className="text-slate-400 text-center text-sm mb-6">
              Enter your email and we'll send you a link to reset your password.
            </p>
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
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 flex justify-center items-center gap-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-black/30 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Send size={18} />
                )}
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <p className="mt-4 text-center text-sm text-slate-400">
              Remember your password? <Link to="/login" className="text-cyan-400 hover:underline">Sign In</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
