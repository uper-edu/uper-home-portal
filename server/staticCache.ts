import path from 'node:path';
import compression from 'compression';
import type {Response} from 'express';

/** Only files actually served from the public frontend directory use this policy. */
export function frontendCacheControl(relativeFile: string) {
  const file = relativeFile.replaceAll('\\', '/');
  if (file.startsWith('../') || file.startsWith('/') || file.split('/').includes('..')) return 'private, no-store';
  // Shells and runtime metadata must be fetched again after a release.
  if (/\.(?:html?|json|webmanifest|map)$/i.test(file) || /(?:^|\/)(?:sw|service-worker)\.js$/i.test(file)) return 'private, no-store';
  const publicExtension = /\.(?:m?js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico|mp3|ogg|wav|mp4|webm)$/i;
  if (file.startsWith('assets/') && /-[A-Za-z0-9_-]{8,}\.[^.]+$/.test(file) && publicExtension.test(file)) return 'public, max-age=31536000, immutable';
  if (publicExtension.test(file) || /\.(?:txt|xml)$/i.test(file)) return 'public, no-cache';
  return 'private, no-store';
}

export function frontendStaticOptions(directory: string) {
  return {
    index: false as const,
    cacheControl: false,
    etag: true,
    lastModified: true,
    setHeaders(response: Response, file: string) {
      // Overrides the conservative company/private default only after static
      // serving has resolved a real public file. API handlers never use this.
      response.setHeader('Cache-Control', frontendCacheControl(path.relative(directory, file)));
    },
  };
}

export const frontendStaticCompression = compression({
  filter(request, response) {
    const type = String(response.getHeader('Content-Type') ?? '');
    const cacheControl = String(response.getHeader('Cache-Control') ?? '');
    return !request.headers.range && response.statusCode === 200 &&
      cacheControl.includes('immutable') &&
      /^(?:text\/css|(?:text|application)\/javascript)(?:;|$)/i.test(type) &&
      compression.filter(request, response);
  },
});
