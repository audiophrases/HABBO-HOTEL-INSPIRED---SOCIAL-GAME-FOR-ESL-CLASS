import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AvatarEditor from '../components/AvatarEditor';
import type { AvatarConfig } from '../utils/AvatarRenderer';
import './Login.css';

export default function Login() {
  const [step, setStep] = useState<'details' | 'avatar'>('details');
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  const handleAvatarSave = (avatarConfig: AvatarConfig) => {
    navigate('/game', { state: { username: username.trim(), roomCode: pin, avatarConfig } });
  };

  return (
    <div className="login-wrapper" style={{ backgroundImage: 'url(/background.jpg)' }}>
      <div className="login-overlay" />
      <main className="login-content">
        <div className="login-brand animate-float">
          <h1 className="heading-pixel login-title">Pixel Plaza</h1>
          <p className="login-subtitle">A social space for English class</p>
        </div>
        <div className="glass-panel login-card">
          {step === 'details' ? (
            <form className="login-form" onSubmit={event => {
              event.preventDefault();
              if (/^\d{4,8}$/.test(pin) && /^[\p{L}\p{N} _-]{2,24}$/u.test(username.trim())) setStep('avatar');
            }}>
              <h2 className="card-title">Join your class</h2>
              <div className="input-group">
                <label className="input-label" htmlFor="pin">Class PIN</label>
                <input className="input-field pin-input" id="pin" inputMode="numeric" pattern="[0-9]{4,8}"
                  minLength={4} maxLength={8} autoComplete="off" required value={pin}
                  onChange={event => setPin(event.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="username">Your display name</label>
                <input className="input-field" id="username" minLength={2} maxLength={24} required
                  autoComplete="off" value={username} onChange={event => setUsername(event.target.value)} />
              </div>
              <button className="btn btn-primary login-btn" type="submit">Choose your avatar</button>
            </form>
          ) : <AvatarEditor onSave={handleAvatarSave} onCancel={() => setStep('details')} />}
          <p className="login-notice">Your teacher can review every message. Messages appear after teacher approval.</p>
          <Link className="teacher-link" to="/teacher">Teacher controls</Link>
        </div>
      </main>
    </div>
  );
}
