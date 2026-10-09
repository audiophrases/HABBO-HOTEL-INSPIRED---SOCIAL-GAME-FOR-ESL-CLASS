import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Colyseus from 'colyseus.js';
import PhaserGame from '../components/PhaserGame';
import { websocketUrl } from '../config';
import { readStudentSession } from '../studentAuth';
import type { AvatarConfig } from '../utils/AvatarRenderer';
import './Game.css';

interface GameState {
  roomCode: string;
  avatarConfig: AvatarConfig;
}

interface ChatMessage {
  sender: string;
  text: string;
  timestamp?: number;
}

export default function Game() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as GameState | null;
  const [session] = useState(() => readStudentSession());
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [connectedRoom, setConnectedRoom] = useState<Colyseus.Room | null>(null);
  const roomRef = useRef<Colyseus.Room | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state?.roomCode || !session) {
      navigate('/');
      return;
    }

    const connectColyseus = async () => {
      try {
        const client = new Colyseus.Client(websocketUrl);
        const room = await client.joinOrCreate('lobby', { 
          pin: state.roomCode,
          studentToken: session.studentToken,
          avatarConfig: state.avatarConfig
        });
        roomRef.current = room;
        setConnectedRoom(room);

        room.onMessage('chat_message', (message: ChatMessage) => {
          setMessages(prev => [...prev, message]);
        });

        room.onMessage('chat_warning', (warning: { message: string }) => {
          setMessages(prev => [...prev, { sender: 'System Warning', text: warning.message }]);
        });
        room.onMessage('chat_pending', (notice: { message: string }) => {
          setMessages(prev => [...prev, { sender: 'System', text: notice.message }]);
        });
        room.onMessage('chat_decision', (notice: { message: string }) => {
          setMessages(prev => [...prev, { sender: 'System', text: notice.message }]);
        });

      } catch (e) {
        console.error("Colyseus Connection Error:", e);
        setMessages(prev => [...prev, { sender: 'System Warning', text: 'Could not join. Check your class PIN and Google sign-in, and ask your teacher to open the class.' }]);
      }
    };

    connectColyseus();

    return () => {
      roomRef.current?.leave();
    };
  }, [state, session, navigate]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!state?.roomCode || !session) return null;

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !roomRef.current) return;
    
    // Send message to the server for moderation
    roomRef.current.send('chat', { text: chatInput });
    setChatInput('');
  };

  const handlePreventClipboard = (e: React.ClipboardEvent) => {
    e.preventDefault();
  };

  return (
    <div className="game-container">
      {/* Background Phaser Canvas */}
      {connectedRoom && <PhaserGame username={session.student.displayName} room={connectedRoom} />}
      
      {/* React UI Overlay */}
      <div className="ui-layer">
        <header className="game-header glass-panel">
          <h1 className="heading-pixel" style={{fontSize: '1.2rem', margin: 0}}>Pixel Plaza</h1>
          <div className="room-info">
            <span className="badge">Room: Lobby</span>
            <span className="badge">{session.student.displayName}</span>
            {state.roomCode && <span className="badge">Class: {state.roomCode}</span>}
          </div>
        </header>

        <div className="chat-container glass-panel">
          <div className="chat-messages">
            {messages.map((msg, i) => {
              const isWarning = msg.sender.includes('Warning');
              const isSystem = msg.sender.startsWith('System');
              
              return (
                <div key={i} className={`chat-message ${isSystem ? 'system-msg' : ''} ${isWarning ? 'warning-msg' : ''}`}>
                  <span className="chat-sender">{msg.sender}:</span>
                  <span className="chat-text">{msg.text}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="emote-bar">
            {['🙋', '❓', '👍', '😂'].map(emote => (
              <button 
                key={emote} 
                className="emote-btn" 
                onClick={() => roomRef.current?.send('emote', { emote })}
                title={`Send ${emote} emote`}
              >
                {emote}
              </button>
            ))}
          </div>
          
          <form className="chat-input-wrapper" onSubmit={handleSendMessage}>
            <input 
              type="text" 
              className="chat-input"
              placeholder="Type a message for teacher approval..."
              maxLength={200}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onCopy={handlePreventClipboard}
              onPaste={handlePreventClipboard}
              onCut={handlePreventClipboard}
              autoComplete="off"
              spellCheck="true"
            />
            <button type="submit" className="btn btn-primary chat-send-btn">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
