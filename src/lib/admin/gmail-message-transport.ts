import type { MailSummary } from './gmail-read';
export function redactMailText(text: string) {
  return text.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g,'[REDACTED]')
    .replace(/\b(?:Bearer\s+|GOCSPX-|ya29\.|1\/\/|sk-(?:proj-)?)[A-Za-z0-9._~+\/-]{8,}/gi,'[REDACTED]')
    .replace(/((?:password|passwd|secret|access_token|refresh_token|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi,'$1[REDACTED]');
}
// Fixed GET endpoints only. No attachments, HTML body, modify or send API.
export function gmailMessages(fetcher: typeof fetch = fetch) {
  return async (accessToken: string, after: number, before: number): Promise<MailSummary[]> => {
    if (!accessToken || /[\r\n]/.test(accessToken) || !Number.isSafeInteger(after) || !Number.isSafeInteger(before) ||
        before - after !== 7 * 86400000) throw new Error('invalid read');
    async function get(path: string) {
      const r = await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages'+path,
        {method:'GET',headers:{Authorization:`Bearer ${accessToken}`},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
      if (!r.ok || !r.body) throw new Error('mail unavailable');
      const reader=r.body.getReader(); const chunks:Uint8Array[]=[]; let size=0;
      try { while(true) { const {value,done}=await reader.read(); if(done) break;
        size+=value.byteLength; if(size>65536) throw new Error('mail unavailable'); chunks.push(value); }
      } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
      const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(!data || typeof data!=='object' || Array.isArray(data)) throw new Error('mail unavailable');
      return data;
    }
    const q=new URLSearchParams({labelIds:'INBOX',q:`after:${Math.floor(after/1000)} before:${Math.ceil(before/1000)}`,maxResults:'20'});
    const list=await get('?'+q); const refs=list.messages ?? [];
    if(!Array.isArray(refs) || refs.length>20) throw new Error('mail unavailable');
    const seen=new Set<string>(); const out:MailSummary[]=[];
    for(const ref of refs) {
      if(typeof ref.id!=='string' || !/^[a-fA-F0-9]{1,100}$/.test(ref.id) || seen.has(ref.id)) throw new Error('mail unavailable');
      seen.add(ref.id);
      const m=await get('/'+ref.id+'?format=metadata&metadataHeaders=Subject');
      const date=Number(m.internalDate);
      if(m.id!==ref.id || !Array.isArray(m.labelIds) || m.labelIds.some((v:unknown)=>typeof v!=='string') ||
          !Number.isSafeInteger(date)) throw new Error('mail unavailable');
      // Gmail search uses second precision; enforce millisecond boundary again.
      if(date<after || date>before || !m.labelIds.includes('INBOX')) continue;
      const subject=m.payload?.headers?.find((h:{name?:string})=>h.name?.toLowerCase()==='subject')?.value ?? '';
      if(typeof subject!=='string' || typeof m.snippet!=='string') throw new Error('mail unavailable');
      out.push({id:m.id,internalDate:date,labelIds:['INBOX'],subject:redactMailText(subject).slice(0,500),snippet:redactMailText(m.snippet).slice(0,1000)});
    }
    return out;
  };
}
