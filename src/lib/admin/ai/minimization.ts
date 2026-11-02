import {sha,type Scope,type Segment} from './review';
export type TextRelease={selectedFields?:string[];policyVersion:string;scopeHash:string;expiresAt:number;segments:{id:string;sourceId:string;version:string;sha256:string;assetId:string|null;textHash:string;ranges:{start:number;end:number}[]}[]};
/** Server-owned release manifest, never accepted from HTTP/model output. Explicit ranges are
 * reviewed outside the model. Detection is defense in depth, not a complete PII classifier. */
export function rangeMinimizer(release:TextRelease,now:()=>number=Date.now){
 const pinned=structuredClone(release);
 return async(segments:Segment[],scope:Scope):Promise<Segment[]>=>{
  if(!pinned.policyVersion||pinned.scopeHash!==sha(JSON.stringify(scope))||!Number.isSafeInteger(pinned.expiresAt)||now()>=pinned.expiresAt||!Array.isArray(pinned.segments)||new Set(pinned.segments.map(s=>s.id)).size!==pinned.segments.length)throw Error('minimization_required');
  const out:Segment[]=[];
  for(const rule of pinned.segments){const s=segments.find(s=>s.id===rule.id);if(!s||s.sourceId!==rule.sourceId||s.version!==rule.version||s.sha256!==rule.sha256||(s.assetId??null)!==rule.assetId||sha(s.text)!==rule.textHash||!rule.ranges.length)throw Error('minimization_required');const chars=Array.from(s.text);let end=0;const pieces:string[]=[];
   for(const r of rule.ranges){if(!Number.isSafeInteger(r.start)||!Number.isSafeInteger(r.end)||r.start<end||r.end<=r.start||r.end>chars.length)throw Error('minimization_required');const text=chars.slice(r.start,r.end).join('');
    if(/[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{6}[- ]?[1-8]\d{6}\b|\b01[016789][- ]?\d{3,4}[- ]?\d{4}\b|(?:계좌|account|password|비밀번호|api[_ -]?key|bearer)\s*[:：#]?\s*\S+/i.test(text))throw Error('sensitive_text');
    pieces.push(text);end=r.end;
   }
   // Separator prevents manufacturing a quote spanning omitted private text.
   out.push({...s,text:pieces.join('\n[omitted]\n')});
  }
  if(Buffer.byteLength(JSON.stringify(out))>48000)throw Error('minimization_required');return out;
 };
}
