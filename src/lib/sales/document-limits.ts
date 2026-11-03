/** Locally tested resource ceilings, NOT automatic transmission or spending approval.
 * Existing deployments retain64KB unless an explicit trusted ceiling and DB grant permit more. */
export type DocumentLimits={maxRequestBytes:number;maxFileBytes:number;maxTotalFileBytes:number;maxVisualDocuments:number;maxPagesPerPdf:number;maxTotalVisualPages:number;maxImagePixels:number;maxTotalImagePixels:number;maxDimension:number};
export const testedDocumentLimits:DocumentLimits={maxRequestBytes:8*1024*1024,maxFileBytes:2*1024*1024,maxTotalFileBytes:5*1024*1024,maxVisualDocuments:4,maxPagesPerPdf:5,maxTotalVisualPages:12,maxImagePixels:16000000,maxTotalImagePixels:32000000,maxDimension:6000};
export const legacyDocumentLimits:DocumentLimits={...testedDocumentLimits,maxRequestBytes:64000};
export function documentLimits(input:unknown,ceiling:DocumentLimits=testedDocumentLimits):DocumentLimits{
 if(!input||typeof input!=='object'||Object.keys(input).sort().join()!==Object.keys(testedDocumentLimits).sort().join())throw Error('visual_limits_invalid');
 const value=input as DocumentLimits;
 for(const k of Object.keys(testedDocumentLimits) as (keyof DocumentLimits)[])if(!Number.isSafeInteger(value[k])||value[k]<1||value[k]>ceiling[k])throw Error('visual_limits_invalid');
 return {...value};
}
export const base64Bytes=(bytes:number)=>4*Math.ceil(bytes/3);
export function checkVisualTotals(files:{bytes:number;pages:number;width:number|null;height:number|null;pixels?:number}[],limits:DocumentLimits){
 const totalBytes=files.reduce((n,f)=>n+f.bytes,0),pages=files.reduce((n,f)=>n+f.pages,0),pixels=files.reduce((n,f)=>n+(f.pixels??(f.width??0)*(f.height??0)),0);
 if(files.length>limits.maxVisualDocuments||totalBytes>limits.maxTotalFileBytes||pages>limits.maxTotalVisualPages||pixels>limits.maxTotalImagePixels||files.some(f=>f.bytes>limits.maxFileBytes||f.pages>limits.maxPagesPerPdf||(f.width??0)>limits.maxDimension||(f.height??0)>limits.maxDimension||(f.pixels??(f.width??0)*(f.height??0))>limits.maxImagePixels))throw Error('visual_input_limit');
 // Conservative bound excluding all metadata/text overhead; exact UTF-8 request measured afterward.
 const encodedBytes=files.reduce((n,f)=>n+base64Bytes(f.bytes),0);if(encodedBytes>limits.maxRequestBytes)throw Error('visual_input_limit');
 return {totalBytes,pages,pixels,encodedBytes};
}
