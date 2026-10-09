import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { serverUrl } from '../config';
import './Teacher.css';

type Entry = { id: string; studentKey: string; sender: string; text: string; timestamp: number; status: string };
type Status = { open: boolean; entries: Entry[]; muted: string[] };

export default function Teacher() {
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');

  const request = useCallback(async (path: string, body?: object): Promise<Status> => {
    const response = await fetch(`${serverUrl}/api/teacher/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'x-teacher-key': key, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Request failed.');
    return result as Status;
  }, [key]);

  const refresh = useCallback(async () => {
    try { setStatus(await request('status')); setError(''); }
    catch (cause) { setStatus(null); setError(cause instanceof Error ? cause.message : 'Connection failed.'); }
  }, [request]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setInterval(() => { void refresh(); }, 2000);
    return () => window.clearInterval(timer);
  }, [status, refresh]);

  const action = async (path: string, body: object) => {
    try { setStatus(await request(path, body)); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed.'); }
  };

  return <main className="teacher-page">
    <header className="teacher-header">
      <div><h1>Teacher controls</h1><p>All student chat waits for your approval.</p></div>
      <Link to="/">Student entrance</Link>
    </header>
    {!status ? <form className="teacher-signin" onSubmit={event => { event.preventDefault(); void refresh(); }}>
      <label htmlFor="teacher-key">Teacher key</label>
      <input id="teacher-key" type="password" value={key} onChange={event => setKey(event.target.value)} required />
      <button className="btn btn-primary">Open controls</button>
    </form> : <>
      <section className="teacher-controls">
        <strong>Class is {status.open ? 'open' : 'closed'}</strong>
        <button className="btn btn-primary" onClick={() => void action('class', { open: !status.open })}>
          {status.open ? 'Close class' : 'Open class'}
        </button>
        <button className="btn btn-secondary" onClick={() => { setStatus(null); setKey(''); }}>Sign out</button>
      </section>
      <section className="teacher-entries">
        <h2>Chat review</h2>
        {status.entries.length === 0 && <p>No messages yet.</p>}
        {status.entries.map(entry => <article key={entry.id} className="teacher-entry">
          <div><strong>{entry.sender}</strong> <small>{new Date(entry.timestamp).toLocaleTimeString()} · {entry.status}</small></div>
          <p>{entry.text}</p>
          <div className="teacher-actions">
            {entry.status === 'pending' && <>
              <button onClick={() => void action('review', { id: entry.id, approve: true })}>Approve</button>
              <button onClick={() => void action('review', { id: entry.id, approve: false })}>Reject</button>
            </>}
            <button onClick={() => void action('mute', { studentKey: entry.studentKey, muted: !status.muted.includes(entry.studentKey) })}>
              {status.muted.includes(entry.studentKey) ? 'Unmute' : 'Mute'} student
            </button>
          </div>
        </article>)}
      </section>
    </>}
    {error && <p role="alert" className="teacher-error">{error}</p>}
  </main>;
}
