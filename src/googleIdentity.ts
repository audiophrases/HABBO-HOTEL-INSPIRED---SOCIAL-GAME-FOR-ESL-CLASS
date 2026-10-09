type GoogleIdentity = {
  initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
  renderButton: (element: HTMLElement, options: { theme: string; size: string; text: string; width: number }) => void;
  disableAutoSelect?: () => void;
};

declare global {
  interface Window { google?: { accounts: { id: GoogleIdentity } } }
}

let scriptPromise: Promise<GoogleIdentity> | null = null;
let initializedClientId = '';
let credentialHandler: ((credential: string) => void) | null = null;

function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => window.google?.accounts.id ? resolve(window.google.accounts.id) : reject(new Error('Google sign-in did not load.'));
      script.onerror = () => reject(new Error('Google sign-in did not load.'));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export async function renderGoogleButton(element: HTMLElement, clientId: string, onCredential: (credential: string) => void): Promise<void> {
  const identity = await loadGoogleIdentity();
  credentialHandler = onCredential;
  if (initializedClientId !== clientId) {
    identity.initialize({
      client_id: clientId,
      callback: response => { if (response.credential) credentialHandler?.(response.credential); }
    });
    initializedClientId = clientId;
  }
  element.replaceChildren();
  identity.renderButton(element, { theme: 'filled_blue', size: 'large', text: 'continue_with', width: 260 });
}
