import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

async function extractPdf() {
  const data = new Uint8Array(fs.readFileSync('HSK测评题.pdf'));
  const loadingTask = getDocument({ data });
  const pdfDocument = await loadingTask.promise;
  console.log('Number of pages:', pdfDocument.numPages);
  
  let fullText = '';
  for (let i = 1; i <= pdfDocument.numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += `\n--- PAGE ${i} ---\n` + pageText;
  }
  fs.writeFileSync('extracted_pdf.txt', fullText);
  console.log('Extracted successfully to extracted_pdf.txt');
}

extractPdf().catch(err => console.error(err));
