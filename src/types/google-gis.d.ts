// Google Identity Services type definitions

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: TokenClientError) => void;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface TokenClientError {
  type: string;
  message: string;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: Partial<TokenClientConfig>) => void;
}

interface GoogleAccounts {
  accounts: {
    oauth2: {
      initTokenClient: (config: TokenClientConfig) => TokenClient;
    };
  };
}

interface Window {
  google?: GoogleAccounts;
}
