/** Deployment-owned opt-in. No browser assertion enables local OCR. */
export function localOcrEnabled(env:Record<string,string|undefined>){return env.SALES_AI_LOCAL_OCR==='local-ocr-v1';}
