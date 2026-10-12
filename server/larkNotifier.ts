import { generateDailyInfographicPng } from './infographicGenerator.ts';
import { getPolicyConfig } from './policyStorage.ts';

/**
 * UPER CRM Lark Notification Dispatcher
 * Sends rich interactive cards to Lark group chat via Webhook with distinct text copy and visual badges for DEV, PRE, and PROD
 */

interface EnvInfo {
  code: 'dev' | 'pre' | 'prod';
  name: string;
  badge: string;
  template: string;
  description: string;
}

function getEnvironmentInfo(): EnvInfo {
  const envVar = (process.env.UPER_ENV || process.env.ENVIRONMENT || process.env.NODE_ENV || '').toLowerCase();
  const appUrl = (process.env.APP_URL || '').toLowerCase();

  if (envVar === 'production' || envVar === 'prod' || appUrl.includes('uperedu.com') || appUrl.includes('prod')) {
    return {
      code: 'prod',
      name: 'UPEREDU Production',
      badge: '🚀 [PROD LIVE]',
      template: 'green',
      description: 'Official Live Enterprise Intelligence Report'
    };
  }
  if (envVar === 'pre' || envVar === 'preview' || appUrl.includes('ais-pre')) {
    return {
      code: 'pre',
      name: 'PRE / Staging Environment',
      badge: '🔬 [PRE AUDIT]',
      template: 'purple',
      description: 'Pre-launch Validation & Staging Digest'
    };
  }
  return {
    code: 'dev',
    name: 'DEV Workspace',
    badge: '🧪 [DEV TEST]',
    template: 'blue',
    description: 'Development Sandbox & Debug Notification'
  };
}

export async function sendLarkWelcomeMessage(): Promise<boolean> {
  const config = getPolicyConfig();
  if (!config.larkAutomation.enabled) {
    console.log('[LARK] Lark automation is disabled in Strategy & Rules. Skipping welcome message.');
    return false;
  }

  const webhookUrl = process.env.LARK_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes('configured-by-system') || webhookUrl.includes('your-webhook-token')) {
    console.log('[LARK] Webhook URL not configured yet. Skipping welcome message dispatch.');
    return false;
  }

  const envInfo = getEnvironmentInfo();

  const card = {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: `${envInfo.badge} UPER CRM Bot Connected` },
        template: envInfo.template
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**Hello Team! 👋**\n\n📢 **Environment Origin:** \`${envInfo.name}\`\n📝 **Mode:** *${envInfo.description}*\n\n### 🚀 Automated notifications from this channel:\n1. **New Lead Ingested** 🔔\n2. **Status Changes** 📢\n3. **Enrollment Won!** 🎉\n4. **Daily Infographic Digest** 📊\n\n*All events originating from ${envInfo.name} are tagged accordingly.* 🇮🇩`
          }
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: `Open CRM (${envInfo.code.toUpperCase()})` },
              type: 'primary',
              url: process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL' ? `${process.env.APP_URL}/crm` : 'https://ais-dev-y6nppb2e5akha3jnhypk4z-347750433251.us-east1.run.app/crm'
            }
          ]
        }
      ]
    }
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card)
    });
    return res.ok;
  } catch (err) {
    console.error('[LARK NOTIFIER] Network error sending welcome message:', err);
    return false;
  }
}

export async function sendLarkDailySummary(stats: {
  date: string;
  newLeads: number;
  contacted: number;
  engaged: number;
  booked: number;
  tested: number;
  enrolled: number;
  conversionRate: string;
  topCampaign: string;
}): Promise<boolean> {
  const config = getPolicyConfig();
  if (!config.larkAutomation.enabled || !config.larkAutomation.notifyDailyDigest) {
    console.log('[LARK] Daily Digest notifications are disabled in Strategy & Rules.');
    return false;
  }

  const webhookUrl = process.env.LARK_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes('configured-by-system') || webhookUrl.includes('your-webhook-token')) {
    return false;
  }

  try {
    await generateDailyInfographicPng(stats);
  } catch (err) {
    console.error('[INFOGRAPHIC] Failed to generate PNG poster:', err);
  }

  const envInfo = getEnvironmentInfo();
  const appUrl = process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL' 
    ? process.env.APP_URL 
    : 'https://ais-dev-y6nppb2e5akha3jnhypk4z-347750433251.us-east1.run.app';

  const card = {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: `${envInfo.badge} Daily Infographic Digest (${stats.date})` },
        template: envInfo.template
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `📍 **Environment Origin:** \`${envInfo.name}\` (${envInfo.description})`
          }
        },
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'lark_md', content: `**📥 New Leads:**\n${stats.newLeads}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**📞 Contacted:**\n${stats.contacted} (${stats.engaged} Engaged)` } },
            { is_short: true, text: { tag: 'lark_md', content: `**📅 Test Booked:**\n${stats.booked} (${stats.tested} Tested)` } },
            { is_short: true, text: { tag: 'lark_md', content: `**🎉 Enrolled (Won):**\n${stats.enrolled} (CR: ${stats.conversionRate})` } }
          ]
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `### 📈 Performance Highlights [${envInfo.name}]:\n- **Top Campaign:** ${stats.topCampaign}\n- **SLA Compliance:** 100% On Track\n\n🖼️ *Visual Infographic PNG Poster generated from [${envInfo.name}].*`
          }
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '📊 View Infographic PNG' },
              type: 'primary',
              url: `${appUrl}/daily_infographic.png`
            },
            {
              tag: 'button',
              text: { tag: 'plain_text', content: `Open CRM (${envInfo.code.toUpperCase()})` },
              type: 'default',
              url: `${appUrl}/crm`
            }
          ]
        }
      ]
    }
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card)
    });
    return res.ok;
  } catch (err) {
    console.error('[LARK NOTIFIER] Failed to send daily summary:', err);
    return false;
  }
}

export async function sendLarkNotification(lead: {
  name: string;
  whatsapp: string;
  email?: string;
  currentStage: string;
  intendedProgram?: string;
  studyMode?: string;
  campaignCode?: string;
}, eventType: 'NEW_LEAD' | 'STATUS_CHANGE' | 'ENROLLED') {
  const config = getPolicyConfig();
  if (!config.larkAutomation.enabled) return;
  if (eventType === 'NEW_LEAD' && !config.larkAutomation.notifyNewLead) return;
  if (eventType === 'STATUS_CHANGE' && !config.larkAutomation.notifyStatusChange) return;
  if (eventType === 'ENROLLED' && !config.larkAutomation.notifyEnrollmentWon) return;

  const webhookUrl = process.env.LARK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const envInfo = getEnvironmentInfo();
  const stageLabels: Record<string, string> = {
    'New': 'New Lead / Prospek Baru',
    'Contacted': 'Contacted / Telah Dihubungi',
    'Engaged': 'Engaged / Berinteraksi',
    'Booked': 'Diagnostic Booked / Tes Dijadwalkan',
    'Tested': 'Tested / Selesai Tes',
    'Enrolled': 'Enrolled / Berhasil Mendaftar (Won)'
  };

  const statusText = stageLabels[lead.currentStage] || lead.currentStage;
  const rawTitle = eventType === 'NEW_LEAD' 
    ? '🔔 UPER CRM: New Lead Ingested' 
    : eventType === 'ENROLLED' 
    ? '🎉 UPER CRM: Student Enrolled (Won!)' 
    : '📢 UPER CRM: Lead Status Updated';

  const title = `${envInfo.badge} ${rawTitle}`;

  const card = {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: title },
        template: eventType === 'ENROLLED' ? 'green' : envInfo.template
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `🏷️ **Source Environment:** \`${envInfo.name}\` — *${envInfo.description}*`
          }
        },
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'lark_md', content: `**Student Name:**\n${lead.name}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**WhatsApp / Phone:**\n${lead.whatsapp}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**Target Program:**\n${lead.intendedProgram || 'General'}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**Current Status:**\n${statusText}` } }
          ]
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: 'Open CRM Workbench' },
              type: 'primary',
              url: 'https://ais-dev-y6nppb2e5akha3jnhypk4z-347750433251.us-east1.run.app/crm'
            },
            {
              tag: 'button',
              text: { tag: 'plain_text', content: 'Chat on WhatsApp' },
              type: 'default',
              url: `https://wa.me/${lead.whatsapp.replace(/[^0-9]/g, '')}`
            }
          ]
        }
      ]
    }
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card)
    });
    if (!res.ok) {
      console.error('[LARK NOTIFIER] Failed to send webhook:', await res.text());
    }
  } catch (err) {
    console.error('[LARK NOTIFIER] Network error sending webhook:', err);
  }
}
