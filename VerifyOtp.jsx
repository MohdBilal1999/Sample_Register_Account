import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendOtp, verifyOtp, register } from '../api';

const COOLDOWN_SECONDS = 60;

export default function VerifyOtp() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(null);
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const raw = sessionStorage.getItem('pendingRegistration');
    if (!raw) {
      navigate('/register', { replace: true });
      return;
    }
    setPending(JSON.parse(raw));
    setDemoOtp(sessionStorage.getItem('demoOtp') || '');
    setResendCooldown(COOLDOWN_SECONDS);
  }, [navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleVerify(e) {
    e.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit OTP.');
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(pending.mobile, otp);
      const result = await register({
        name: pending.name,
        email: pending.email,
        password: pending.password,
        mobile: pending.mobile
      });

      sessionStorage.removeItem('pendingRegistration');
      sessionStorage.removeItem('demoOtp');
      sessionStorage.setItem('authToken', result.token);
      sessionStorage.setItem('authUser', JSON.stringify(result.user));
      navigate('/success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || !pending) return;
    setError('');
    setLoading(true);
    try {
      const result = await sendOtp(pending.mobile, pending.email);
      setDemoOtp(result.demoOtp || '');
      sessionStorage.setItem('demoOtp', result.demoOtp || '');
      setResendCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!pending) return null;

  return (
    <div className="card">
      <h1>Verify OTP</h1>
      <p className="subtitle">
        Enter the code sent to <strong>{pending.mobile}</strong>
      </p>

      {demoOtp && (
        <div className="demo-banner">
          <strong>Demo mode:</strong> Your OTP is <strong>{demoOtp}</strong> (also printed in the API
          console).
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleVerify}>
        <label>
          6-digit OTP
          <input
            className="otp-input"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify and create account'}
        </button>
      </form>

      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button
          type="button"
          className="secondary"
          onClick={handleResend}
          disabled={loading || resendCooldown > 0}
        >
          {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
        </button>
        {resendCooldown > 0 && <p className="cooldown">You can request a new code after the cooldown.</p>}
      </div>

      <div className="nav-links">
        <Link to="/register">Back to registration</Link>
      </div>
    </div>
  );
}
