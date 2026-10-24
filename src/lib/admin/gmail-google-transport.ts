// Fixed Google endpoints. Caller supplies secrets from an approved secret service;
// this module never reads environment, disk, browser sessions or logs credentials.
export function googleTransport(clientId: string, clientSecret: string, fetcher: typeof fetch = fetch) {
  async function json(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    const response = await fetcher(url, { ...init, redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(10000) });
    if (!response.ok || !response.body) throw new Error('google unavailable');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 16384) throw new Error('response too large');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('invalid response');
    return result;
  }
  return {
    async refresh(refreshToken: string) {
      if (!clientId || !clientSecret || !refreshToken || refreshToken.length > 4096)
        throw new Error('configuration unavailable');
      const t = await json('https://oauth2.googleapis.com/token', { method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret,
          refresh_token: refreshToken, grant_type: 'refresh_token' }) });
      if (typeof t.access_token !== 'string' || !t.access_token || t.access_token.length > 4096 ||
          typeof t.token_type !== 'string' || t.token_type.toLowerCase() !== 'bearer' ||
          !Number.isSafeInteger(t.expires_in) || (t.expires_in as number) < 1 || (t.expires_in as number) > 86400 ||
          (t.scope !== undefined && t.scope !== 'https://www.googleapis.com/auth/gmail.readonly') ||
          (t.refresh_token !== undefined && (typeof t.refresh_token !== 'string' || !t.refresh_token || t.refresh_token.length > 4096)))
        throw new Error('invalid refresh response');
      // Scope may be omitted on refresh; original stored grant must remain readonly.
      // Caller must check account generation, mailbox and any rotated token save
      // before using the access token. Never silently fall back to another account.
      return { accessToken: t.access_token, expiresIn: t.expires_in as number,
        rotatedRefreshToken: t.refresh_token as string | undefined };
    },
    async revoke(token: string) {
      if (!token || token.length > 4096) throw new Error('invalid credential');
      const response = await fetcher('https://oauth2.googleapis.com/revoke', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('revocation unconfirmed');
    },
    async exchange(code: string, verifier: string, redirect: string) {
      if (!clientId || !clientSecret || redirect !== 'https://punghyun.vercel.app/api/integrations/gmail/oauth/callback')
        throw new Error('configuration unavailable');
      const t = await json('https://oauth2.googleapis.com/token', { method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret,
          code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' }) });
      for (const k of ['access_token','refresh_token','token_type','scope'])
        if (typeof t[k] !== 'string') throw new Error('invalid token response');
      return { access_token: t.access_token as string, refresh_token: t.refresh_token as string,
        token_type: t.token_type as string, scope: t.scope as string };
    },
    async profile(accessToken: string) {
      if (!accessToken || /[\r\n]/.test(accessToken)) throw new Error('invalid access token');
      const p = await json('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } });
      if (typeof p.emailAddress !== 'string') throw new Error('invalid profile');
      return { emailAddress: p.emailAddress };
    },
  };
}
