// Commit both datasets together: a refreshed total must describe the visible cohort.
export async function loadCampaignWorkspace(request: typeof fetch) {
  const responses = await Promise.all([
    request('/api/crm/campaigns'),
    request('/api/crm/leads?workScope=all&ownership=all&task=all'),
  ]);
  if (responses.some(response => !response.ok)) throw Error('Campaign data unavailable');
  const [campaigns, leads] = await Promise.all(responses.map(response => response.json()));
  if (!Array.isArray(campaigns.campaigns) || !Array.isArray(leads.leads)) throw Error('Campaign data unavailable');
  return {campaigns: campaigns.campaigns, leads: leads.leads};
}
