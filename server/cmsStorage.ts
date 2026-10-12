import fs from 'fs';
import path from 'path';

const CONTENT_DIR = path.join(process.cwd(), 'src/data/content');
const UPLOAD_DIR = path.join(process.cwd(), 'public/images/uploads');

export function ensureUploadDirExists() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

const ALLOWED_COLLECTIONS = [
  'partners',
  'news',
  'newsPage',
  'trendingPrograms',
  'studentStories',
  'campaigns',
  'admissionsList'
];

export function getCmsContent(collection: string) {
  if (!ALLOWED_COLLECTIONS.includes(collection)) {
    throw new Error(`Invalid collection: ${collection}`);
  }
  const filePath = path.join(CONTENT_DIR, `${collection}.json`);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function saveCmsContent(collection: string, items: any[]) {
  if (!ALLOWED_COLLECTIONS.includes(collection)) {
    throw new Error(`Invalid collection: ${collection}`);
  }
  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }
  const filePath = path.join(CONTENT_DIR, `${collection}.json`);
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf8');

  // If dist/data/content exists in production, also update it
  const distContentDir = path.join(process.cwd(), 'dist/data/content');
  if (fs.existsSync(distContentDir)) {
    fs.writeFileSync(path.join(distContentDir, `${collection}.json`), JSON.stringify(items, null, 2), 'utf8');
  }
  return items;
}

export function upsertCmsItem(collection: string, item: any) {
  const items = getCmsContent(collection);
  if (!item._id) {
    item._id = `cms-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    item._createdAt = new Date().toISOString();
    item._updatedAt = new Date().toISOString();
    items.unshift(item);
  } else {
    item._updatedAt = new Date().toISOString();
    const index = items.findIndex((i: any) => i._id === item._id || i.id === item._id);
    if (index >= 0) {
      items[index] = { ...items[index], ...item };
    } else {
      items.unshift(item);
    }
  }
  saveCmsContent(collection, items);
  return item;
}

export function deleteCmsItem(collection: string, id: string) {
  const items = getCmsContent(collection);
  const filtered = items.filter((i: any) => i._id !== id && i.id !== id);
  saveCmsContent(collection, filtered);
  return { success: true };
}

export function saveUploadedImage(fileName: string, base64Data: string) {
  ensureUploadDirExists();
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  
  // Safe filename
  const ext = path.extname(fileName) || '.png';
  const baseName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeName = `${Date.now()}-${baseName}${ext}`;
  
  const destPath = path.join(UPLOAD_DIR, safeName);
  fs.writeFileSync(destPath, buffer);

  // If in production and dist exists, copy to dist/images/uploads too
  const distUploadDir = path.join(process.cwd(), 'dist/images/uploads');
  if (fs.existsSync(path.join(process.cwd(), 'dist'))) {
    if (!fs.existsSync(distUploadDir)) {
      fs.mkdirSync(distUploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(distUploadDir, safeName), buffer);
  }

  return `/images/uploads/${safeName}`;
}
