import { getKV, setKV } from '../../db/kv';
import { loadGIS } from './gis';

const CLIENT_ID_KEY = 'googleClientId';
const TOKEN_SESSION_KEY = 'googleAccessToken';
const SCOPE_KEY = 'googleOAuthScope';
const REQUIRED_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

// In-memory token storage
let currentToken: string | null = null;

/**
 * Get stored Google OAuth Client ID
 */
export async function getClientId(): Promise<string | null> {
  return await getKV<string>(CLIENT_ID_KEY);
}

/**
 * Set Google OAuth Client ID
 */
export async function setClientId(clientId: string): Promise<void> {
  await setKV(CLIENT_ID_KEY, clientId);
  // Clear token when client ID changes
  currentToken = null;
  sessionStorage.removeItem(TOKEN_SESSION_KEY);
}

/**
 * Get current access token (from memory or sessionStorage)
 * Also checks if scope matches required scope
 */
export async function getAccessToken(): Promise<string | null> {
  if (currentToken) {
    // Check if scope matches
    const storedScope = await getKV<string>(SCOPE_KEY);
    if (storedScope !== REQUIRED_SCOPE) {
      // Scope mismatch, clear token
      clearAccessToken();
      return null;
    }
    return currentToken;
  }
  // Try to restore from sessionStorage
  const stored = sessionStorage.getItem(TOKEN_SESSION_KEY);
  if (stored) {
    // Check scope
    const storedScope = await getKV<string>(SCOPE_KEY);
    if (storedScope !== REQUIRED_SCOPE) {
      // Scope mismatch, clear token
      clearAccessToken();
      return null;
    }
    currentToken = stored;
    return stored;
  }
  return null;
}

/**
 * Set access token (store in memory and sessionStorage)
 */
function setAccessToken(token: string, scope: string): void {
  currentToken = token;
  sessionStorage.setItem(TOKEN_SESSION_KEY, token);
  setKV(SCOPE_KEY, scope);
}

/**
 * Clear access token
 */
export function clearAccessToken(): void {
  currentToken = null;
  sessionStorage.removeItem(TOKEN_SESSION_KEY);
}

/**
 * Connect to Google and request access token
 */
export async function connectGoogle(): Promise<string> {
  const clientId = await getClientId();
  if (!clientId) {
    throw new Error('Google OAuth Client ID not set. Please enter it in Settings.');
  }

  const google = await loadGIS();

  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: REQUIRED_SCOPE,
      callback: (response: TokenResponse) => {
        if (response.access_token) {
          setAccessToken(response.access_token, REQUIRED_SCOPE);
          resolve(response.access_token);
        } else {
          reject(new Error('No access token received'));
        }
      },
      error_callback: (error: TokenClientError) => {
        reject(new Error(`OAuth error: ${error.message || error.type}`));
      },
    });

    tokenClient.requestAccessToken();
  });
}

/**
 * Check if user is connected (has valid token)
 */
export async function isConnected(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}
