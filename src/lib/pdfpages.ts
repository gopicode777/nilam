/**
 * Renders PDF pages to JPEG in the browser, because Groq's vision models take images, not PDFs (max 3 per request).
 * Long documents send the first 3 and last 3 pages: parties, survey no. and extent are usually at the start, the property schedule at the end.
 * pdf.js is loaded on demand so it never slows the landing page.
 */
export async function renderPdfPages(file: Blob): Promise<{ images: string[]; pageNos: number[] }> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const n = pdf.numPages, pick = n <= 6 ? Array.from({ length: n }, (_, i) => i + 1) : [1, 2, 3, n - 2, n - 1, n];
  // second attempt is smaller if the first would make the request too big
  for (const [edge, q] of [[1500, 0.72], [1100, 0.6]] as const) {
    const images: string[] = [];
    for (const p of pick) {
      const page = await pdf.getPage(p), v0 = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2.5, edge / Math.max(v0.width, v0.height)) });
      const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
      images.push(canvas.toDataURL('image/jpeg', q)); canvas.width = canvas.height = 0;
    }
    if (images.join('').length < 6_000_000) return { images, pageNos: pick };
  }
  throw new Error('PDF pages are too large to send');
}
