/** Disabled-by-default service endpoint candidate. No credential discovery. */
import {createHash,timingSafeEqual} from 'node:crypto';
const OWNER='874162eb-d569-448b-bc8b-cf103cf46c1c',MAIL='sol.hong@punghyun.com';
const SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const response=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
export async function readServerMail(request,cfg,d,now=Date.now()) {
 try {
  const u=new URL(request.url);
  if(request.method!=='GET'||u.origin!=='https://punghyun.vercel.app'||u.pathname!=='/api/integrations/agent/mail'||u.search||request.headers.has('cookie'))return response({error:'invalid_request'},400);
  const issued=Date.parse(cfg.issued??''),expires=Date.parse(cfg.expires??'');
  if(cfg.enabled!=='true'||cfg.purpose!=='gmail_summary_read'||cfg.account!=='sol_hong'||cfg.owner!==OWNER||
     !/^[a-f0-9]{64}$/.test(cfg.hash??'')||!/^[a-f0-9]{64}$/.test(cfg.customerGrantHash??'')||cfg.hash===cfg.customerGrantHash||
     !Number.isFinite(issued)||!Number.isFinite(expires)||issued>now||expires<=now||expires<=issued||expires-issued>7*86400000)return response({error:'unavailable'},503);
  const auth=request.headers.get('authorization')??'';
  if(!/^Bearer [A-Za-z0-9_-]{43,128}$/.test(auth)||!timingSafeEqual(createHash('sha256').update(auth.slice(7)).digest(),Buffer.from(cfg.hash,'hex')))return response({error:'unauthorized'},401);
  if(!d?.enabled)return response({error:'unavailable'},503);
  // This is service-grant authentication, not a forged browser user/session.
  // Reuse only bounded vault/read dependencies; never call/override identity().
  const row=await d.load();
  if(!row||row.owner!==OWNER||row.accountId!=='sol_hong'||row.mailbox!==MAIL||row.scope!==SCOPE||row.status!=='active'||
     !Number.isSafeInteger(row.generation)||row.generation<1||JSON.stringify(row.labelIds)!=='["INBOX"]')return response({error:'account_unavailable'},409);
  const token=await d.refresh(d.open(row,row.envelope));let generation=row.generation;
  if(token.rotatedRefreshToken)generation=await d.rotate(row,token.rotatedRefreshToken);
  if(!await d.current(generation)||(await d.profile(token.accessToken)).emailAddress!==MAIL)throw Error();
  const after=now-7*86400000,messages=await d.messages(token.accessToken,after,now);
  if(!Array.isArray(messages)||messages.length>20)throw Error();
  const seen=new Set();
  const bounded=messages.map(m=>{
   if(!m||Object.keys(m).sort().join(',')!=='id,internalDate,labelIds,snippet,subject'||! /^[a-fA-F0-9]{1,100}$/.test(m.id)||seen.has(m.id)||
      !Number.isSafeInteger(m.internalDate)||m.internalDate<after||m.internalDate>now||JSON.stringify(m.labelIds)!=='["INBOX"]'||
      typeof m.subject!=='string'||m.subject.length>500||typeof m.snippet!=='string'||m.snippet.length>1000)throw Error();
   seen.add(m.id);return {id:m.id,internalDate:m.internalDate,labelIds:['INBOX'],subject:m.subject,snippet:m.snippet};
  });
  if(!await d.current(generation)||(d.now??Date.now)()>=expires)throw Error();
  return response({accountId:'sol_hong',untrusted:true,messages:bounded});
 }catch{return response({error:'mail_read_unavailable'},503);}
}
