/**
 * Client-Side PDF Image Extractor for HSK Official Exam Papers
 * Renders official PDF pages at 2.5x high resolution and crops the exact authentic images.
 */
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker for pdfjs-dist
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  // Use official unpkg CDN worker matching the installed pdfjs-dist
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

export interface CropRegion {
  id: string; // e.g. "car", "bullet_train", "airplane"
  pageIndex: number; // 1-based page index
  // Relative percentages (0.0 to 1.0) of page width & height
  x: number;
  y: number;
  width: number;
  height: number;
}

// Exact normalized coordinates for every question image in HSK测评题.pdf
export const HSK_PDF_CROP_REGIONS: CropRegion[] = [
  // ================= PAGE 2: 听力 第 1～3 题 =================
  // Row 1: Q1 (A: Car, B: Bullet Train, C: Airplane)
  { id: 'car', pageIndex: 2, x: 0.08, y: 0.32, width: 0.27, height: 0.17 },
  { id: 'bullet_train', pageIndex: 2, x: 0.37, y: 0.32, width: 0.27, height: 0.17 },
  { id: 'airplane', pageIndex: 2, x: 0.66, y: 0.32, width: 0.27, height: 0.17 },

  // Row 2: Q2 (A: Cover Ears, B: Cover Eyes, C: Shh)
  { id: 'cover_ears', pageIndex: 2, x: 0.08, y: 0.54, width: 0.27, height: 0.17 },
  { id: 'cover_eyes', pageIndex: 2, x: 0.37, y: 0.54, width: 0.27, height: 0.17 },
  { id: 'shh', pageIndex: 2, x: 0.66, y: 0.54, width: 0.27, height: 0.17 },

  // Row 3: Q3 (A: Bird on Branch, B: Cat on Chair, C: Dog under Chair)
  { id: 'bird_branch', pageIndex: 2, x: 0.08, y: 0.76, width: 0.27, height: 0.17 },
  { id: 'cat_on_chair', pageIndex: 2, x: 0.37, y: 0.76, width: 0.27, height: 0.17 },
  { id: 'dog_under_chair', pageIndex: 2, x: 0.66, y: 0.76, width: 0.27, height: 0.17 },

  // ================= PAGE 4: 听力 第 8～10 题 =================
  // Row 1: A, B, C
  { id: 'hand_bottle', pageIndex: 4, x: 0.08, y: 0.31, width: 0.27, height: 0.18 },
  { id: 'headache', pageIndex: 4, x: 0.37, y: 0.31, width: 0.27, height: 0.18 },
  { id: 'driver_car_wave', pageIndex: 4, x: 0.66, y: 0.31, width: 0.27, height: 0.18 },

  // Row 2: D, E, F
  { id: 'soccer_girl', pageIndex: 4, x: 0.08, y: 0.53, width: 0.27, height: 0.18 },
  { id: 'laughing_tv', pageIndex: 4, x: 0.37, y: 0.53, width: 0.27, height: 0.18 },
  { id: 'boy_books', pageIndex: 4, x: 0.66, y: 0.53, width: 0.27, height: 0.18 },

  // ================= PAGE 7: 阅读 第 22～25 题 =================
  // Row 1: A, B, C
  { id: 'guitar_boy', pageIndex: 7, x: 0.08, y: 0.28, width: 0.27, height: 0.18 },
  { id: 'schoolgirl', pageIndex: 7, x: 0.37, y: 0.28, width: 0.27, height: 0.18 },
  { id: 'umbrella', pageIndex: 7, x: 0.66, y: 0.28, width: 0.27, height: 0.18 },

  // Row 2: D, E, F
  { id: 'eggs_milk', pageIndex: 7, x: 0.08, y: 0.49, width: 0.27, height: 0.18 },
  { id: 'reading_chair', pageIndex: 7, x: 0.37, y: 0.49, width: 0.27, height: 0.18 },
  { id: 'two_men_waving', pageIndex: 7, x: 0.66, y: 0.49, width: 0.27, height: 0.18 }
];

/**
 * Extracts all authentic HSK exam images directly from the uploaded PDF file.
 * Returns a dictionary mapping imageId -> PNG base64 data URL.
 */
export async function extractHskImagesFromPdf(
  file: File, 
  onProgress?: (msg: string) => void
): Promise<Record<string, string>> {
  const arrayBuffer = await file.arrayBuffer();
  onProgress?.('Loading PDF document...');

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const extractedMap: Record<string, string> = {};

  // Group crops by page
  const pageGroups = new Map<number, CropRegion[]>();
  for (const crop of HSK_PDF_CROP_REGIONS) {
    if (!pageGroups.has(crop.pageIndex)) {
      pageGroups.set(crop.pageIndex, []);
    }
    pageGroups.get(crop.pageIndex)!.push(crop);
  }

  // Process required pages (Page 2, 4, 7)
  const totalPages = pageGroups.size;
  let pageCount = 0;

  for (const [pageNum, crops] of pageGroups.entries()) {
    if (pageNum > pdf.numPages) continue;

    pageCount++;
    onProgress?.(`Rendering & cropping Page ${pageNum} of ${pdf.numPages}...`);

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.5 }); // 2.5x high resolution

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) continue;

    // Render full PDF page to invisible canvas
    await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;

    // Crop each image region from this rendered page
    for (const crop of crops) {
      const cropX = Math.round(crop.x * canvas.width);
      const cropY = Math.round(crop.y * canvas.height);
      const cropW = Math.round(crop.width * canvas.width);
      const cropH = Math.round(crop.height * canvas.height);

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');

      if (cropCtx) {
        cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const dataUrl = cropCanvas.toDataURL('image/png', 0.95);
        extractedMap[crop.id] = dataUrl;
      }
    }
  }

  onProgress?.(`Extracted ${Object.keys(extractedMap).length} real exam images!`);
  return extractedMap;
}
