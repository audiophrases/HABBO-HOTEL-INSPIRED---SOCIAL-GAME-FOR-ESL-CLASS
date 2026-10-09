import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Colyseus from 'colyseus.js';
import PhaserGame from '../components/PhaserGame';
import './Game.css';

interface GameState {
  username: string;
  roomCode?: string;
}

interface ChatMessage {
  sender: string;
  text: string;
  timestamp?: number;
}

export default function Game() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as GameState;
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [connectedRoom, setConnectedRoom] = useState<Colyseus.Room | null>(null);
  const roomRef = useRef<Colyseus.Room | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state?.username) {
      navigate('/');
      return;
    }

    const connectColyseus = async () => {
      try {
        const client = new Colyseus.Client('ws://localhost:2567');
        const room = await client.joinOrCreate('lobby', { 
          username: state.username,
          avatarConfig: (state as any).avatarConfig
        });
        roomRef.current = room;
        setConnectedRoom(room);

        room.onMessage('chat_message', (message: ChatMessage) => {
          setMessages(prev => [...prev, message]);
        });

        room.onMessage('chat_warning', (warning: { message: string }) => {
          setMessages(prev => [...prev, { sender: 'System Warning', text: warning.message }]);
        });

      } catch (e) {
        console.error("Colyseus Connection Error:", e);
        setMessages(prev => [...prev, { sender: 'System Warning', text: 'Error connecting to chat server.' }]);
      }
    };

    connectColyseus();

    return () => {
      roomRef.current?.leave();
    };
  }, [state, navigate]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!state?.username) return null;

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
      {connectedRoom && <PhaserGame username={state.username} room={connectedRoom} />}
      
      {/* React UI Overlay */}
      <div className="ui-layer">
        <header className="game-header glass-panel">
          <h1 className="heading-pixel" style={{fontSize: '1.2rem', margin: 0}}>Pixel Plaza</h1>
          <div className="room-info">
            <span className="badge">Room: Lobby</span>
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
          
          <form className="chat-input-wrapper" onSubmit={handleSendMessage}>
            <input 
              type="text" 
              className="chat-input"
              placeholder="Type to chat (English only)..."
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
