import { queryLeads } from './leadStorage.ts';
import { sendLarkDailySummary } from './larkNotifier.ts';
import { getPolicyConfig } from './policyStorage.ts';

let lastSentDate = '';

export function initLarkDailyScheduler() {
  // Check every 10 minutes
  setInterval(async () => {
    try {
      const config = getPolicyConfig();
      if (!config.larkAutomation.enabled || !config.larkAutomation.notifyDailyDigest) {
        return;
      }

      const [targetHourStr, targetMinuteStr] = (config.larkAutomation.dailyDigestTime || '18:00').split(':');
      const targetHour = parseInt(targetHourStr, 10) || 18;
      const targetMinute = parseInt(targetMinuteStr, 10) || 0;

      // Get current time in Jakarta (Asia/Jakarta is UTC+7)
      const now = new Date();
      const jakartaTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
      const jakartaDate = new Date(jakartaTimeStr);
      
      const hours = jakartaDate.getHours();
      const minutes = jakartaDate.getMinutes();
      const dateKey = jakartaDate.toISOString().slice(0, 10); // YYYY-MM-DD

      // Match target hour and within 10-minute window
      if (hours === targetHour && minutes >= targetMinute && minutes < targetMinute + 10 && lastSentDate !== dateKey) {
        console.log(`[LARK CRON] Triggering automated daily infographic digest at configured time ${config.larkAutomation.dailyDigestTime} WIB...`);
        lastSentDate = dateKey;

        const { leads } = queryLeads({});
        const newLeads = leads.filter(l => l.currentStage === 'New').length;
        const contacted = leads.filter(l => l.currentStage === 'Contacted').length;
        const engaged = leads.filter(l => l.currentStage === 'Engaged').length;
        const booked = leads.filter(l => l.currentStage === 'Booked').length;
        const tested = leads.filter(l => l.currentStage === 'Tested').length;
        const enrolled = leads.filter(l => l.currentStage === 'Enrolled').length;
        const total = leads.length || 1;
        const cr = ((enrolled / total) * 100).toFixed(1) + '%';

        await sendLarkDailySummary({
          date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          newLeads,
          contacted,
          engaged,
          booked,
          tested,
          enrolled,
          conversionRate: cr,
          topCampaign: 'Meta Ads & Campus QR - Jakarta Hub'
        });
        console.log('[LARK CRON] Automated daily infographic digest successfully dispatched.');
      }
    } catch (err) {
      console.error('[LARK CRON ERROR]', err);
    }
  }, 10 * 60 * 1000); // Check every 10 minutes

  console.log('[LARK CRON] Daily automated scheduler initialized with Policy Config integration.');
}
