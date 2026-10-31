export type AssetInput={id:string;model:string;serial:string;quantity:string};
export type DocumentInput={customer:string;purchaseBase:string;purchaseVat:string;purchaseTotal:string;rentalBase:string;rentalVat:string;rentalTotal:string;startDate:string;expiryDate:string;dueDate:string;paymentVariant:string;assets:AssetInput[]};
export const PAYMENT_VARIANT='expiry_once_bank_holiday_next_business_day';
export function validateDocumentInput(input:DocumentInput):DocumentInput{
 const text=(v:unknown,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[{}\x00-\x1f]/.test(v))throw Error('required_input');return v.trim();};
 const money=(v:unknown)=>{if(typeof v!=='string'||!/^\d{1,12}$/.test(v))throw Error('invalid_amount');return BigInt(v);};
 const date=(v:unknown)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))throw Error('invalid_date');const t=Date.parse(v+'T00:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==v)throw Error('invalid_date');return t;};
 if(input.paymentVariant!==PAYMENT_VARIANT)throw Error('unapproved_variant');
 for(const p of ['purchase','rental'] as const){const base=money(input[`${p}Base`]),vat=money(input[`${p}Vat`]),total=money(input[`${p}Total`]);if(base<=BigInt(0)||base+vat!==total||base%BigInt(10)!==BigInt(0)||vat!==base/BigInt(10))throw Error('vat_mismatch');}
 const start=date(input.startDate),expiry=date(input.expiryDate),due=date(input.dueDate);if(expiry-start!==7*86400000||due<expiry)throw Error('date_review_required');
 // Holiday adjustment is human-confirmed; no holiday calendar or business-day inference.
 if(!Array.isArray(input.assets)||input.assets.length<1||input.assets.length>20)throw Error('invalid_assets');const ids=new Set<string>();const assets=input.assets.map(a=>{const id=text(a.id,60);if(ids.has(id))throw Error('duplicate_asset');ids.add(id);if(!/^[1-9]\d?$/.test(a.quantity))throw Error('invalid_quantity');return {id,model:text(a.model),serial:text(a.serial),quantity:a.quantity};});
 return {...input,customer:text(input.customer),assets};
}
export function inputBinding(input:DocumentInput){return JSON.stringify(validateDocumentInput(input));}
