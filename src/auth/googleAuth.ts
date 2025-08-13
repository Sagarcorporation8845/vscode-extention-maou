import * as vscode from 'vscode';
import * as http from 'http';
import * as crypto from 'crypto';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
  id_token?: string;
}

export class GoogleAuth {
  private accessToken: string | undefined;
  private accessTokenExpiryMs: number | undefined;
  private refreshTokenCached = false;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async initialize(): Promise<void> {
    const rt = await this.context.secrets.get('maou.refresh_token');
    this.refreshTokenCached = !!rt;
  }

  isAuthenticatedSync(): boolean {
    return !!this.accessToken || this.refreshTokenCached;
  }

  async isAuthenticated(): Promise<boolean> {
    const rt = await this.context.secrets.get('maou.refresh_token');
    this.refreshTokenCached = !!rt;
    return !!this.accessToken || this.refreshTokenCached;
  }

  async login(): Promise<void> {
    const config = vscode.workspace.getConfiguration('maou');
    const clientId = config.get<string>('google.clientId')!;
    const clientSecret = config.get<string>('google.clientSecret')!;
    const authUri = config.get<string>('google.authUri')!;
    const tokenUri = config.get<string>('google.tokenUri')!;
    const scopes = config.get<string[]>('google.scopes')!;

    // Localhost loopback
    const server = http.createServer();
    const port = await new Promise<number>((resolve, reject) => {
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          resolve(address.port);
        } else {
          reject(new Error('Failed to bind local server'));
        }
      });
    });

    const redirectUri = `http://localhost:${port}`;
    const verifier = base64Url(crypto.randomBytes(32));
    const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());

    const url = new URL(authUri);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');

    await vscode.env.openExternal(vscode.Uri.parse(url.toString()));

    const code = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('OAuth login timed out'));
      }, 5 * 60 * 1000);

      server.on('request', async (req, res) => {
        try {
          const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
          const codeParam = reqUrl.searchParams.get('code');
          const error = reqUrl.searchParams.get('error');
          if (error) {
            clearTimeout(timeout);
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<h1>Login failed</h1><p>${error}</p>`);
            reject(new Error(error));
            server.close();
            return;
          }
          if (codeParam) {
            clearTimeout(timeout);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Login successful</h1><p>You may close this window and return to VS Code.</p>');
            resolve(codeParam);
            server.close();
          } else {
            res.writeHead(404);
            res.end();
          }
        } catch (e) {
          reject(e);
          server.close();
        }
      });
    });

    const tokenResp = await this.exchangeCodeForTokens(tokenUri, clientId, clientSecret, code, redirectUri, verifier);
    await this.storeTokens(tokenResp);
  }

  async logout(): Promise<void> {
    await this.context.secrets.delete('maou.refresh_token');
    await this.context.secrets.delete('maou.access_token');
    await this.context.secrets.delete('maou.access_expiry');
    this.accessToken = undefined;
    this.accessTokenExpiryMs = undefined;
    this.refreshTokenCached = false;
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && this.accessTokenExpiryMs && now < this.accessTokenExpiryMs - 60_000) {
      return this.accessToken;
    }
    const cached = await this.context.secrets.get('maou.access_token');
    const expiryStr = await this.context.secrets.get('maou.access_expiry');
    if (cached && expiryStr && now < parseInt(expiryStr, 10) - 60_000) {
      this.accessToken = cached;
      this.accessTokenExpiryMs = parseInt(expiryStr, 10);
      return cached;
    }

    const refreshToken = await this.context.secrets.get('maou.refresh_token');
    if (!refreshToken) {
      throw new Error('Not authenticated');
    }

    const config = vscode.workspace.getConfiguration('maou');
    const clientId = config.get<string>('google.clientId')!;
    const clientSecret = config.get<string>('google.clientSecret')!;
    const tokenUri = config.get<string>('google.tokenUri')!;

    const refreshed = await this.refreshAccessToken(tokenUri, clientId, clientSecret, refreshToken);
    await this.storeTokens(refreshed);
    return this.accessToken!;
  }

  private async exchangeCodeForTokens(
    tokenUri: string,
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<TokenResponse> {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const resp = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Token exchange failed: ${resp.status} ${text}`);
    }
    const json = (await resp.json()) as TokenResponse;
    return json;
  }

  private async refreshAccessToken(
    tokenUri: string,
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): Promise<TokenResponse> {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const resp = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Token refresh failed: ${resp.status} ${text}`);
    }
    const json = (await resp.json()) as TokenResponse;
    if (!json.refresh_token) {
      json.refresh_token = refreshToken; // keep existing
    }
    return json;
  }

  private async storeTokens(tokens: TokenResponse) {
    const expiryMs = Date.now() + tokens.expires_in * 1000;
    this.accessToken = tokens.access_token;
    this.accessTokenExpiryMs = expiryMs;

    await this.context.secrets.store('maou.access_token', tokens.access_token);
    await this.context.secrets.store('maou.access_expiry', String(expiryMs));
    if (tokens.refresh_token) {
      await this.context.secrets.store('maou.refresh_token', tokens.refresh_token);
    }
  }
}

function base64Url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}