import {AsyncLocalStorage} from 'node:async_hooks';
export const campaignsContext=new AsyncLocalStorage();

const publicReadsWithoutCampaignSnapshot = new Set([
  '/enrollment/availability',
  '/enrollment/classes',
  '/portal/session',
]);

// Mounted under /api. These reads do not consume the CRM campaign snapshot.
export function campaignContextMiddleware(pool) {
  return async (request, _response, next) => {
    if ((request.method === 'GET' || request.method === 'HEAD') &&
      publicReadsWithoutCampaignSnapshot.has(request.path)) {
      next();
      return;
    }
    try {
      const {rows} = await pool.query('SELECT config FROM trial_campaigns ORDER BY created_at DESC');
      campaignsContext.run(rows.map(row => row.config), next);
    } catch (error) {
      next(error);
    }
  };
}
