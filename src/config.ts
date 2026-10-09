export const serverUrl = (import.meta.env.VITE_SERVER_URL || 'http://localhost:2567').replace(/\/$/, '');
export const websocketUrl = serverUrl.replace(/^http/, 'ws');
