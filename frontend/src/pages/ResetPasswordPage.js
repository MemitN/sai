import React, { useState, useEffect } from 'react';
import api from '../hooks/useApi';

// Use absolute path for logo
const logoSrc = '/logo.jpeg';



export default function ResetPasswordPage() {
  // Get token from URL without react-router-dom
  const getTokenFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
  };
  
  const token = getTokenFromUrl();
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      setStep('reset');
    }
  }, [token]);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/password/reset-request', { email });
      setMessage(data.message);
      setEmail('');
    } catch(e) {
      setError(e.response?.data?.error || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      setError('Password must be at least 4 digits');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/password/reset', { token, new_password: newPassword });
      setMessage('Password reset successful! Redirecting to login...');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch(e) {
      setError(e.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 450 }}>
        <div className="login-logo">
          {logoSrc ? (
            <img src={logoSrc} alt="Sai Lounge" style={{ width: 70, height: 70, borderRadius: '50%', marginBottom: 12 }} />
          ) : (
            <div style={{ fontSize: 48, marginBottom: 12 }}>🍹</div>
          )}
          <h1>Sai <span style={{ color: '#F59E0B' }}>Lounge</span></h1>
          <p>{step === 'request' ? 'Password Recovery' : 'Reset Password'}</p>
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', color: '#DC2626', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{ background: '#D1FAE5', color: '#065F46', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            {message}
          </div>
        )}

        {step === 'request' && (
          <form onSubmit={handleRequestReset}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your registered email"
                required
              />
              <div style={{ fontSize: 11, color: '#78716C', marginTop: 5 }}>
                Enter the email associated with your admin/management account
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
              style={{ marginTop: 16 }}
            >
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Send Reset Link'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button type="button" onClick={goToLogin} style={{ color: '#F59E0B', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>
                Back to Login
              </button>
            </div>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label className="form-label">New Password (PIN)</label>
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter 4-6 digit PIN"
                maxLength={6}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your PIN"
                maxLength={6}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
              style={{ marginTop: 16 }}
            >
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}