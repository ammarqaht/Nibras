/**
 * Browser-only caching for heavy read endpoints.
 *
 * The club program has ended and the app is now browsed read-only (no new
 * uploads or edits), so this data no longer changes. Letting the browser cache
 * these responses means repeat navigations and page reloads are served from
 * cache instead of re-hitting the origin — which sharply cuts Vercel
 * "Fast Origin Transfer" and keeps the project inside the free tier.
 *
 * `private` = cached per-user in the browser only (never a shared CDN), which is
 * correct for authenticated, per-supervisor responses.
 */
export const READ_CACHE_HEADERS = { 'Cache-Control': 'private, max-age=120' };
