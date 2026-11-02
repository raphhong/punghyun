import {sha, type Segment, type Source} from './review';

export const pdfParserVersion = 'pdfjs-6.5.438-text-v98';
/** Text extraction only. No OCR, table interpretation, scripts, URLs or font downloads.
 * The trial caller must hash-allowlist bytes BEFORE invoking this parser.
 * The deadline is cooperative; it is not a sandbox for arbitrary hostile PDFs. */
export async function extractPdfText(source: Source, signal?: AbortSignal): Promise<Segment[]> {
  if (source.mime.split(';')[0] !== 'application/pdf' || source.bytes.length < 8 || source.bytes.length > 8 * 1024 * 1024 ||
      sha(source.bytes) !== source.sha256 || Buffer.from(source.bytes.subarray(0, 5)).toString() !== '%PDF-') throw Error('source_unreadable');
  const {getDocument} = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({data: new Uint8Array(source.bytes), useWorkerFetch: false,
    useWasm: false, disableFontFace: true, useSystemFonts: false, verbosity: 0, stopAtErrors: true});
  let stopped = false;
  const stop = () => {stopped = true; void task.destroy().catch(() => {});};
  const timer = setTimeout(stop, 8000);
  signal?.addEventListener('abort', stop, {once: true});
  const check = () => {if (stopped || signal?.aborted) throw Error('source_unreadable');};
  try {
    check();
    const doc = await task.promise;
    if (doc.numPages < 1 || doc.numPages > 20 || doc.isPureXfa || await doc.hasJSActions() ||
        await doc.getAttachments() || await doc.getOpenAction()) throw Error('source_unreadable');
    const segments: Segment[] = [];
    let count = 0;
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      check();
      const page = await doc.getPage(pageNumber);
      if (await page.getJSActions()) throw Error('source_unreadable');
      const content = await page.getTextContent({disableNormalization: true});
      if (content.items.length > 10000) throw Error('source_unreadable');
      // Keep PDF.js item ordering and explicit line breaks. This is not row/column reconstruction.
      const text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : '') : '').join('');
      count += text.length;
      if (count > 12000) throw Error('source_unreadable');
      if (text.trim()) {
        const locator = 'page:' + pageNumber;
        segments.push({id: 'seg-' + sha(JSON.stringify([source.id, source.version, source.sha256, pdfParserVersion, locator])),
          sourceId: source.id, version: source.version, sha256: source.sha256, locator, text, assetId: source.assetId});
      } else throw Error('source_unreadable'); // No silent omission of scanned/blank pages.
      page.cleanup();
    }
    check();
    return segments;
  } catch {throw Error('source_unreadable');}
  finally {clearTimeout(timer); signal?.removeEventListener('abort', stop); await task.destroy().catch(() => {});}
}
