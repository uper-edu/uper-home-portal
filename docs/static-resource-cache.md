# Static resource cache — #734

Current implementation: `server/staticCache.ts`, mounted only on the frontend public file directory. This note does not authorize deployment.

| Resource | Cache-Control |
|---|---|
| Existing, content-hashed JS/CSS/fonts/media under `assets/` | `public, max-age=31536000, immutable` |
| Unversioned public images, logos and other supported static files | `public, no-cache`; retain ETag and Last-Modified for conditional 304 responses |
| HTML, JSON including build metadata, service-worker scripts, source maps and unknown files | `private, no-store` |

The company-trial/private default remains conservative. The verified static file handler overrides only Cache-Control for a real public file. X-Robots-Tag, VPN/Basic access, staff authorization, private API policy and existing CMS media handlers remain unchanged. A missing resource is not an HTML success response.

Release checklist:

1. Back up before an authorized release. Do not delete retained historical hashed resources in this fix.
2. Verify a fresh entry HTML loads the new content-hashed URLs. Previously retained URLs must still return the same bytes; do not reuse a hashed URL for changed content.
3. Inspect final HTTPS response headers through the company proxy, not only backend headers. Keep the noindex policy and sensitive response protection.
4. With browser cache enabled, compare normal repeat page loads and cross-page navigation. A hard reload, disabled-cache setting, or explicit request `Cache-Control: no-cache` is not evidence of normal reuse.
5. Conditional clients must send the matching ETag without a forced no-cache directive when checking for 304. Some HTTP clients add request no-cache automatically; record request conditions.
6. Local validation and company-mode middleware unit tests do not prove the deployed company proxy configuration. Repeat the bounded resource checks after separately authorized publication.

No customer data, HSK rules, notification strategy or historical jobs are changed. No service worker, offline customer-data cache or CDN is introduced.
