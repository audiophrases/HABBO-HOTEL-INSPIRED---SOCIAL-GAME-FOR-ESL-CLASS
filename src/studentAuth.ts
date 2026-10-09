import { serverUrl } from './config';

export type Student = { studentKey: string; displayName: string; className: string };
export type StudentSession = { studentToken: string; expiresAt: number; student: Student };
export type StudentConfig = { loginEnabled: boolean; googleClientId: string; allowedDomains: string[] };

const sessionKey = 'pinplay.student.v1';

export function readStudentSession(): StudentSession | null {
  try {
    const raw = localStorage.getItem(sessionKey);
    const session = raw ? JSON.parse(raw) as StudentSession : null;
    return session && typeof session.studentToken === 'string' && session.expiresAt > Date.now()
      && typeof session.student?.studentKey === 'string' && typeof session.student?.displayName === 'string'
      ? session : null;
  } catch { return null; }
}

export function saveStudentSession(session: StudentSession): void {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

export function clearStudentSession(): void {
  try { localStorage.removeItem(sessionKey); } catch { /* storage disabled */ }
  window.google?.accounts.id.disableAutoSelect?.();
}

async function studentRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${serverUrl}/api/student/${path}`, init);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Student sign-in failed.');
  return result as T;
}

export function fetchStudentConfig(): Promise<StudentConfig> {
  return studentRequest<StudentConfig>('config');
}

export function fetchStudentProfile(token: string): Promise<{ student: Student }> {
  return studentRequest<{ student: Student }>('me', { headers: { 'x-student-token': token } });
}

export function exchangeGoogleCredential(googleIdToken: string): Promise<StudentSession> {
  return studentRequest<StudentSession>('login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ googleIdToken })
  });
}
