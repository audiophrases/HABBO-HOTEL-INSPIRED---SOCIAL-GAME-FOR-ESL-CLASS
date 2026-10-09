import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AvatarEditor from '../components/AvatarEditor';
import type { AvatarConfig } from '../utils/AvatarRenderer';
import './Login.css';

export default function Login() {
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [loginMethod, setLoginMethod] = useState<'guest' | 'google' | null>(null);
  const navigate = useNavigate();

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim().length >= 4) {
      setStep(2);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setStep(4);
    }
  };

  const handleAvatarSave = (avatarConfig: AvatarConfig) => {
    navigate('/game', { state: { username, roomCode: pin, avatarConfig } });
  };

  const handleGoogleSignIn = () => {
    // Placeholder for actual Google Sign In
    setUsername('Google Student');
    setLoginMethod('google');
  };

  return (
    <div className="login-wrapper" style={{ backgroundImage: 'url(/background.jpg)' }}>
      <div className="login-overlay"></div>
      
      <main className="login-content">
        <div className="login-brand animate-float">
          <h1 className="heading-pixel login-title">Pixel Plaza</h1>
          <p className="login-subtitle">The Social Game for ESL Students</p>
        </div>

        <div className="glass-panel login-card">
          {step === 1 && (
            <form onSubmit={handlePinSubmit} className="login-form">
              <h2 className="card-title">Join a Class</h2>
              <div className="input-group">
                <label htmlFor="pin" className="input-label" style={{ textAlign: 'center' }}>Game PIN</label>
                <input
                  id="pin"
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  className="input-field pin-input"
                  placeholder="123456"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoComplete="one-time-code"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary login-btn">
                Validate PIN
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="login-form">
              <h2 className="card-title">Who are you?</h2>
              
              {!loginMethod ? (
                <div className="auth-options">
                  <div className="google-btn-wrapper" onClick={handleGoogleSignIn}>
                    <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Sign in with Google
                  </div>
                  
                  <div className="divider"><span>OR</span></div>
                  
                  <button className="btn guest-btn" onClick={() => setLoginMethod('guest')}>
                    Play as Guest
                  </button>
                </div>
              ) : (
                <form onSubmit={handleJoin} style={{ width: '100%' }}>
                  <div className="input-group">
                    <label htmlFor="username" className="input-label">Student Name</label>
                    <input
                      id="username"
                      type="text"
                      className="input-field"
                      placeholder="Enter your real name"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  
                  {/* Placeholder for PinPlay Avatar Editor */}
                  <div className="avatar-placeholder">
                    <span className="dice-icon" title="Reroll Avatar">🎲</span>
                    <div className="avatar-circle"></div>
                    <p>Avatar Editor (Coming soon)</p>
                  </div>

                  <button type="submit" className="btn btn-primary login-btn">
                    Enter Plaza <span>→</span>
                  </button>
                  <button type="button" className="link-btn" onClick={() => setLoginMethod(null)}>
                    Back
                  </button>
                </form>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="login-step step-avatar">
              <AvatarEditor onSave={handleAvatarSave} onCancel={() => setStep(3)} />
            </div>
          )}

          <div className="safety-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <p>Safe, Moderated English-Only Environment</p>
          </div>
        </div>
      </main>
    </div>
  );
}
