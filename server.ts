import {mountHskAssets} from "./server/hskAssets.ts";
import { mountPortal } from './server/portal/runtime.ts';
import { mountChat } from './server/portal/chat.ts';
import { startWorker } from './server/portal/worker.ts';
import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { getSystemInstruction } from './src/data/knowledgeBase.ts';
import { 
  upsertLeadFromIntake, 
  queryLeads, 
  getLeadById, 
  addFollowUpLog, 
  updateLeadDetails, 
  generateLarkSheetCsv,
  syncLeadChatMessages 
} from './server/leadStorage.ts';
import { 
  getCmsContent, 
  saveCmsContent, 
  upsertCmsItem, 
  deleteCmsItem, 
  saveUploadedImage 
} from './server/cmsStorage.ts';
import { 
  getPolicyConfig, 
  savePolicyConfig, 
  resetPolicyConfig 
} from './server/policyStorage.ts';
import {
  getEnrichedCampaigns,
  loadCampaigns,
  getCurrentCampaigns,
  getCampaignByIdOrCode,
  saveCampaign,
  deleteCampaign,
  trackCampaignImpression,
  synthesizeCampaignAiAssets
} from './server/campaignStorage.ts';

// Load environment variables robustly
const envPath = path.join(process.cwd(), '.env');
const envProdPath = path.join(process.cwd(), '.env.prod');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
} else if (fs.existsSync(envProdPath)) {
  dotenv.config({ path: envProdPath, override: true });
} else {
  dotenv.config();
}

function getValidOpenAiModel(rawModel?: string): string {
  const m = (rawModel || 'gpt-4o').trim();
  const lower = m.toLowerCase();
  if (lower.includes('luna') || lower.includes('gpt-6') || !lower) {
    return 'gpt-4o';
  }
  return m;
}

/**
 * Priority 2 (Code Refactoring): SMTP Credentials and Receivers Helper
 */
interface SmtpConfig {
  smtpUser: string;
  smtpPass: string;
  inquiryReceiver: string;
  careersReceiver: string;
}

function getSmtpConfig(): SmtpConfig {
  const cleanUser = (process.env.GMAIL_USER || '').replace(/['"]/g, '').trim();
  const cleanPass = (process.env.GMAIL_PASS || process.env.GAMIL_PASS || '').replace(/['"]/g, '').replace(/\s+/g, '');
  
  let inquiryReceiver = (process.env.INQUIRY_RECEIVER_EMAIL || process.env.RECEIVER_EMAIL || process.env.RECEIVE_EMAIL || '').replace(/['"]/g, '').trim();
  if (!inquiryReceiver) {
    inquiryReceiver = 'service@uperedu.com';
  }

  let careersReceiver = (process.env.CAREERS_RECEIVER_EMAIL || process.env.RECEIVER_EMAIL || process.env.RECEIVE_EMAIL || '').replace(/['"]/g, '').trim();
  if (!careersReceiver) {
    careersReceiver = 'hr@uperedu.com';
  }

  return {
    smtpUser: cleanUser,
    smtpPass: cleanPass,
    inquiryReceiver,
    careersReceiver,
  };
}

/**
 * Priority 2 (Input Sanitization): Standard Input Sanitizer to prevent HTML injection/XSS
 */
function sanitizeInput(val: any): string {
  if (typeof val !== 'string') return '';
  return val.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
}

/**
 * Priority 1 (Security Hardening): Lightweight In-Memory Rate Limiter
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function createRateLimiter(options: { windowMs: number; max: number; message: string }) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown-ip').split(',')[0].trim();
    const now = Date.now();
    const key = `${req.path}:${ip}`;

    let record = rateLimitMap.get(key);
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + options.windowMs,
      };
    }

    record.count++;
    rateLimitMap.set(key, record);

    res.setHeader('X-RateLimit-Limit', options.max.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - record.count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());

    if (record.count > options.max) {
      res.status(429).json({ error: options.message });
      return;
    }

    next();
  };
}

/**
 * Priority 2 (Input Validation): Email syntax validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 150;
}

async function startServer() {
  const app = express();

  // High-performance gzip/deflate compression for all API and static responses
  app.use(compression());

  // Use NODE_ENV or process execution path to reliably differentiate dev and production.
  const isProd = process.env.NODE_ENV === 'production' || 
                 (process.argv[1] && (process.argv[1].includes('dist') || process.argv[1].includes('server.cjs')));

  // Bind strictly to port 3000 as required by AI Studio reverse proxy
  const PORT = Number(process.env.PORT || 3000);
  const root = process.cwd();
  const distPath = fs.existsSync(path.join(root, 'dist/index.html'))
    ? path.join(root, 'dist')
    : path.join(root, 'build');
  const indexPath = path.join(distPath, 'index.html');

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  await mountPortal(app);
  if (process.env.DATABASE_URL) { mountChat(app); if (process.env.PORTAL_WORKER_ENABLED !== 'false') startWorker(); }
  else if (process.env.LEGACY_CHAT_TEST !== 'true') app.post('/api/chat', (_q, r) => { r.status(503).json({error:'Database required; message not saved'}); });

  // Static directory for versioned source HSK audio assets
  const publicAudioDir = path.join(process.cwd(), 'public/audio');
  if (!fs.existsSync(publicAudioDir)) {
    fs.mkdirSync(publicAudioDir, { recursive: true });
  }
  app.use('/audio', express.static(publicAudioDir));

  // Static directory for direct source PDF crops
  const publicHskImagesDir = path.join(process.cwd(), 'public/images/hsk');
  if (!fs.existsSync(publicHskImagesDir)) {
    fs.mkdirSync(publicHskImagesDir, { recursive: true });
  }
  app.use('/images/hsk', express.static(publicHskImagesDir));

  // Priority 1 (Security Hardening): Standard Secure HTTP Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Ensure AI Studio iframe embedding is unconditionally permitted across all environments
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', "frame-ancestors *;");
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Priority 1 (Security Hardening): Define Rate Limiters
  const formRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // limit each IP to 15 submissions per windowMs
    message: 'Terlalu banyak permintaan. Silakan coba lagi dalam 15 menit. (Too many requests. Please try again in 15 minutes.)'
  });

  const chatRateLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 chatbot turns per minute
    message: 'Terlalu banyak pesan. Silakan perlambat obrolan Anda. (Too many chat messages. Please slow down.)'
  });

  // Log all requests for debugging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API routes first
  app.get('/api/health', (req, res) => {
    const envPath = path.join(process.cwd(), '.env');
    const envProdPath = path.join(process.cwd(), '.env.prod');
    const envExists = fs.existsSync(envPath) || fs.existsSync(envProdPath);
    
    const { smtpUser, smtpPass } = getSmtpConfig();
    const hasDeepseekKey = !!process.env.DEEPSEEK_API_KEY;
    const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
    const openAiModel = getValidOpenAiModel(process.env.OPENAI_MODEL);
    const defaultProvider = process.env.DEFAULT_AI_PROVIDER || process.env.AI_PRIMARY_PROVIDER || (hasOpenAiKey ? 'openai' : 'deepseek');

    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      isProd,
      distPath,
      indexExists: fs.existsSync(indexPath),
      envExists,
      gmailUser: smtpUser || null,
      hasGmailPass: !!smtpPass,
      hasDeepseekKey,
      hasOpenAiKey,
      openAiModel,
      defaultProvider
    });
  });

  // High-speed local content endpoint
  const handleSanityQuery = async (req: express.Request, res: express.Response) => {
    try {
      const query = ((req.method === 'POST' ? req.body.query : req.query.query) as string || '').toLowerCase();
      let params: any = undefined;
      if (req.method === 'POST') {
        params = req.body.params;
      } else if (req.query.params) {
        try {
          params = JSON.parse(req.query.params as string);
        } catch (e) {
          // ignore
        }
      }

      res.setHeader('Cache-Control', 'public, max-age=300');

      const contentDir = path.join(process.cwd(), 'src/data/content');
      const readJson = (file: string) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(contentDir, file), 'utf8'));
        } catch (e) {
          return [];
        }
      };

      let result: any = [];
      if (query.includes('admissionslist')) {
        result = readJson('admissionsList.json');
      } else if (query.includes('campaign')) {
        const campaigns = readJson('campaigns.json');
        if (params?.slug || query.includes('slug.current')) {
          result = campaigns.find((c: any) => c.slug?.current === params?.slug || c.slug === params?.slug) || campaigns[0] || null;
        } else {
          result = campaigns;
        }
      } else if (query.includes('newspage')) {
        result = readJson('newsPage.json');
      } else if (query.includes('news')) {
        const news = readJson('news.json');
        if (params?.slug || query.includes('slug.current')) {
          result = news.find((n: any) => n.slug?.current === params?.slug || n.slug === params?.slug) || null;
        } else {
          result = news;
        }
      } else if (query.includes('partner')) {
        result = readJson('partners.json');
      } else if (query.includes('studentstory')) {
        result = readJson('studentStories.json');
      } else if (query.includes('trendingprogram')) {
        result = readJson('trendingPrograms.json');
      }

      return res.json({ result });
    } catch (err: any) {
      console.error('[CONTENT API ERROR]', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  };

  app.get('/api/sanity', handleSanityQuery);
  app.post('/api/sanity', handleSanityQuery);
  app.get('/api/content', handleSanityQuery);
  app.post('/api/content', handleSanityQuery);

  // Self-owned CMS Content APIs (Local Data & Image Management)
  app.get('/api/cms/content/:type', (req, res) => {
    try {
      const type = req.params.type;
      const data = getCmsContent(type);
      res.json({ success: true, count: data.length, items: data });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/cms/content/:type', (req, res) => {
    try {
      const type = req.params.type;
      const { item, items } = req.body;
      if (items && Array.isArray(items)) {
        saveCmsContent(type, items);
        return res.json({ success: true, count: items.length });
      }
      if (item) {
        const saved = upsertCmsItem(type, item);
        return res.json({ success: true, item: saved });
      }
      res.status(400).json({ error: 'Payload must include item or items' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/cms/content/:type/:id', (req, res) => {
    try {
      const { type, id } = req.params;
      deleteCmsItem(type, id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cms/upload', (req, res) => {
    try {
      const { name, data } = req.body;
      if (!name || !data) {
        return res.status(400).json({ error: 'name and data (base64) are required' });
      }
      const url = saveUploadedImage(name, data);
      res.json({ success: true, url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/log', (req, res) => {
    const errorBody = req.body || { message: 'No body received or parser bypassed' };
    console.log('[CLIENT ERROR]', typeof errorBody === 'object' ? JSON.stringify(errorBody) : errorBody);
    try {
      const logMsg = `[${new Date().toISOString()}] ${JSON.stringify(errorBody)}\n`;
      fs.appendFileSync(path.join(process.cwd(), 'client_errors.log'), logMsg);
    } catch (e) {
      console.error('Failed to write to client_errors.log:', e);
    }
    res.status(204).send();
  });

  app.post('/api/inquiry', formRateLimiter, async (req, res, next) => {
    const rawFullName = req.body.fullName;
    const rawEmail = req.body.email;
    const rawPhone = req.body.phone;
    const rawInterest = req.body.interest;
    const rawMessage = req.body.message;

    if (!rawFullName || !rawEmail || !rawPhone || !rawInterest) {
      res.status(400).json({ error: 'All fields (fullName, email, phone, interest) are required.' });
      return;
    }

    // Priority 2: Input sanitization
    const fullName = sanitizeInput(rawFullName);
    const email = sanitizeInput(rawEmail);
    const phone = sanitizeInput(rawPhone);
    const interest = sanitizeInput(rawInterest);
    const message = sanitizeInput(rawMessage);

    // Priority 2: Input length validation
    if (fullName.length > 100 || email.length > 150 || phone.length > 50 || interest.length > 150 || (message && message.length > 5000)) {
      res.status(400).json({ error: 'Input field length limit exceeded.' });
      return;
    }

    // Priority 2: Email format validation
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Format email tidak valid. (Invalid email address format.)' });
      return;
    }

    console.log(`[INQUIRY RECEIVED] Name: ${fullName}, Email: ${email}, Phone: ${phone}, Interest: ${interest}, Message length: ${message ? message.length : 0}`);

    // Priority 2: Extract SMTP Config helper
    const { smtpUser, smtpPass, inquiryReceiver: receiver } = getSmtpConfig();

    try {
      const debugMsg = `[DEBUG] ${new Date().toISOString()} smtpUser: "${smtpUser}", receiver: "${receiver}", smtpPassLength: ${smtpPass ? smtpPass.length : 0}, smtpPassStart: "${smtpPass ? smtpPass.slice(0, 4) : ''}", smtpPassEnd: "${smtpPass ? smtpPass.slice(-4) : ''}"\n`;
      fs.appendFileSync(path.join(process.cwd(), 'server_debug.log'), debugMsg);
    } catch (e) {
      console.error('Failed to write server_debug.log:', e);
    }

    console.log('[GMAIL CONFIG CHECK]', {
      smtpUser: smtpUser,
      receiver: receiver,
      smtpPassLength: smtpPass ? smtpPass.length : 0,
      hasSmtpPass: !!smtpPass,
    });

    if (!smtpUser || !smtpPass) {
      console.warn('[INQUIRY WARNING] Gmail credentials GMAIL_USER or GMAIL_PASS are missing. Simulating delivery.');
      return res.json({ 
        success: true, 
        simulated: true,
        message: 'Inquiry received. Email delivery simulated because Gmail credentials (GMAIL_USER & GMAIL_PASS) are not configured in environment.' 
      });
    }

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      });

      const htmlContent = `
        <div style="font-family: sans-serif; font-size: 16px; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
            <h2 style="color: #0c4a6e; font-size: 24px; margin: 0 0 8px 0; font-weight: 700;">UPER New Student Inquiry</h2>
            <p style="color: #64748b; margin: 0; font-size: 14px;">Incoming inquiry from UPER Education portal</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; width: 30%; border-bottom: 1px solid #f1f5f9;">Full Name:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${fullName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Email Address:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;"><a href="mailto:${email}" style="color: #0284c7; text-decoration: none;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Mobile Phone:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;"><a href="tel:${phone}" style="color: #0284c7; text-decoration: none;">${phone}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Interested In:</td>
              <td style="padding: 10px 0; color: #0284c7; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${interest}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9; vertical-align: top;">Detailed Description:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9; white-space: pre-wrap; line-height: 1.5;">${message ? message.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '(Not provided)'}</td>
            </tr>
          </table>

          <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; border-left: 4px solid #0284c7; font-size: 14px; color: #475569; margin-bottom: 24px;">
            <strong>Next Step:</strong> Contact the applicant via WhatsApp/Phone or email within 24 hours to follow up on their interest in <strong>${interest}</strong>.
          </div>

          <div style="text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            This inquiry was automatically dispatched by UPER Intelligent Website Solution.
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"${fullName} (UPER Inquiry)" <${smtpUser}>`,
        to: receiver,
        replyTo: email,
        subject: `🔔 New inquiry from ${fullName} (${phone}) - ${interest}`,
        html: htmlContent
      });

      return res.json({ success: true, message: 'Inquiry email sent successfully!' });
    } catch (err: any) {
      console.error('[GMAIL ERROR] Failed to send email via Gmail NodeMailer:', err);
      return res.status(500).json({ 
        error: 'Failed to send inquiry email', 
        details: err?.message || err 
      });
    }
  });

  app.post('/api/apply', formRateLimiter, async (req, res, next) => {
    const rawFullName = req.body.fullName;
    const rawEmail = req.body.email;
    const rawPhone = req.body.phone;
    const rawRoleId = req.body.roleId;
    const rawRoleTitle = req.body.roleTitle;
    const rawExperience = req.body.experience;
    const rawResumeUrl = req.body.resumeUrl;
    const rawCoverLetter = req.body.coverLetter;
    const resumeFileBase64 = req.body.resumeFileBase64;
    const resumeFileName = sanitizeInput(req.body.resumeFileName);

    if (!rawFullName || !rawEmail || !rawPhone || !rawRoleId) {
      res.status(400).json({ error: 'All fields (fullName, email, phone, roleId) are required.' });
      return;
    }

    // Priority 2: Input sanitization
    const fullName = sanitizeInput(rawFullName);
    const email = sanitizeInput(rawEmail);
    const phone = sanitizeInput(rawPhone);
    const roleId = sanitizeInput(rawRoleId);
    const roleTitle = sanitizeInput(rawRoleTitle);
    const experience = sanitizeInput(rawExperience);
    const resumeUrl = sanitizeInput(rawResumeUrl);
    const coverLetter = sanitizeInput(rawCoverLetter);

    // Priority 2: Input length validation
    if (fullName.length > 100 || email.length > 150 || phone.length > 50 || roleId.length > 100 || 
        roleTitle.length > 150 || (experience && experience.length > 1000) || 
        (resumeUrl && resumeUrl.length > 2000) || (coverLetter && coverLetter.length > 5000)) {
      res.status(400).json({ error: 'Input field length limit exceeded.' });
      return;
    }

    // Priority 2: Email format validation
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Format email tidak valid. (Invalid email address format.)' });
      return;
    }

    // Limit attachment size if present (10MB maximum limit)
    if (resumeFileBase64 && resumeFileBase64.length > 15 * 1024 * 1024) {
      res.status(400).json({ error: 'Lampiran resume terlalu besar. Batas maksimal adalah 10MB. (Resume attachment is too large. Maximum size is 10MB.)' });
      return;
    }

    console.log(`[JOB APPLICATION RECEIVED] Name: ${fullName}, Email: ${email}, Phone: ${phone}, Position: ${roleTitle || roleId}`);

    // Priority 2: Extract SMTP Config helper
    const { smtpUser, smtpPass, careersReceiver: receiver } = getSmtpConfig();

    if (!smtpUser || !smtpPass) {
      console.warn('[APPLY WARNING] Gmail credentials GMAIL_USER or GMAIL_PASS are missing. Simulating delivery.');
      return res.json({ 
        success: true, 
        simulated: true,
        message: 'Application received. Email delivery simulated because Gmail credentials are not configured in environment.' 
      });
    }

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      });

      const htmlContent = `
        <div style="font-family: sans-serif; font-size: 16px; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
            <h2 style="color: #0c4a6e; font-size: 24px; margin: 0 0 8px 0; font-weight: 700;">UPER Job Application</h2>
            <p style="color: #64748b; margin: 0; font-size: 14px;">New resume submission from UPER Careers portal</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; width: 30%; border-bottom: 1px solid #f1f5f9;">Full Name:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${fullName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Email Address:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;"><a href="mailto:${email}" style="color: #0284c7; text-decoration: none;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Mobile Phone:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;"><a href="tel:${phone}" style="color: #0284c7; text-decoration: none;">${phone}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Target Position:</td>
              <td style="padding: 10px 0; color: #0284c7; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${roleTitle || roleId}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Experience:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${experience || '(Not specified)'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Cloud Portfolio URL:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${resumeUrl ? `<a href="${resumeUrl}" style="color: #0284c7; text-decoration: none;">${resumeUrl}</a>` : '(Not provided)'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Attached Resume:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-weight: 500;">📎 ${resumeFileName || '(No file attached)'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9; vertical-align: top;">Cover Letter:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9; white-space: pre-wrap; line-height: 1.5;">${coverLetter ? coverLetter.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '(Not provided)'}</td>
            </tr>
          </table>

          <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; border-left: 4px solid #0284c7; font-size: 14px; color: #475569; margin-bottom: 24px;">
            <strong>Next Step:</strong> Review the attached resume/CV (<strong>${resumeFileName}</strong>) and contact the candidate via WhatsApp/Phone at <strong>${phone}</strong> or email to arrange interviews.
          </div>

          <div style="text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            This job application was automatically dispatched by UPER Intelligent Website Solution.
          </div>
        </div>
      `;

      const mailOptions: any = {
        from: `"${fullName} (UPER Application)" <${smtpUser}>`,
        to: receiver,
        replyTo: email,
        subject: `💼 New job application: ${fullName} (${phone}) - ${roleTitle || roleId}`,
        html: htmlContent,
      };

      if (resumeFileBase64 && resumeFileName) {
        mailOptions.attachments = [
          {
            filename: resumeFileName,
            content: Buffer.from(resumeFileBase64, 'base64')
          }
        ];
      }

      await transporter.sendMail(mailOptions);

      return res.json({ success: true, message: 'Application email sent successfully with attachments!' });
    } catch (err: any) {
      console.error('[GMAIL ERROR] Failed to send application email:', err);
      return res.status(500).json({ 
        error: 'Failed to send application email', 
        details: err?.message || err 
      });
    }
  });

  app.post('/api/chatbot-inquiry', formRateLimiter, async (req, res, next) => {
    const rawFullName = req.body.fullName;
    const rawEmail = req.body.email;
    const rawPhone = req.body.phone;
    const rawInterest = req.body.interest;
    const { chatHistory } = req.body;

    if (!rawFullName || !rawPhone || !rawEmail || !rawInterest) {
      res.status(400).json({ error: 'All fields (fullName, phone, email, interest) are required.' });
      return;
    }

    const fullName = sanitizeInput(rawFullName);
    const email = sanitizeInput(rawEmail);
    const phone = sanitizeInput(rawPhone);
    const interest = sanitizeInput(rawInterest);

    // Priority 2: Input length validation
    if (fullName.length > 100 || email.length > 150 || phone.length > 50 || interest.length > 150) {
      res.status(400).json({ error: 'Input field length limit exceeded.' });
      return;
    }

    // Priority 2: Email format validation
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Format email tidak valid. (Invalid email address format.)' });
      return;
    }

    // Guard against excessively large chat histories
    if (chatHistory && (!Array.isArray(chatHistory) || chatHistory.length > 100)) {
      res.status(400).json({ error: 'Invalid chat history array format or limit exceeded.' });
      return;
    }

    console.log(`[CHATBOT INQUIRY RECEIVED] Name: ${fullName}, Phone: ${phone}, Email: ${email}, Interest: ${interest}, Chat history len: ${chatHistory ? chatHistory.length : 0}`);

    // Create a plain-text dialogue transcript
    let transcriptHtml = '';
    let transcriptText = '';
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((msg: any) => {
        if (!msg || !msg.content) return;
        const roleName = msg.role === 'user' ? 'Student/User' : 'UPER AI';
        const rawContent = msg.content;
        
        let displayContent = rawContent;
        // Strip JSON if the message content looks like JSON
        try {
          if (rawContent.trim().startsWith('{')) {
            const parsed = JSON.parse(rawContent);
            if (parsed && parsed.reply) {
              displayContent = parsed.reply;
            }
          }
        } catch (_) {}

        transcriptHtml += `<div style="margin-bottom: 10px; padding: 8px; border-radius: 6px; background-color: ${msg.role === 'user' ? '#f1f5f9' : '#f8fafc'};"><strong>${roleName}:</strong> ${displayContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
        transcriptText += `${roleName}: ${displayContent}\n`;
      });
    }

    if (!transcriptHtml) {
      transcriptHtml = `<em>No dialogue history recorded. Direct consultation request.</em>`;
      transcriptText = `No dialogue history recorded. Direct consultation request.`;
    }

    // Now, let's ask DeepSeek to summarize the dialogue history!
    let aiSummary = 'No summary generated.';
    const apiKey = process.env.DEEPSEEK_API_KEY;
    
    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0 && apiKey) {
      try {
        const apiEndpoint = 'https://api.deepseek.com/chat/completions';
        const modelName = 'deepseek-chat';
        const authHeader = `Bearer ${apiKey}`;

        const summaryInstruction = `You are UPER AI Lead Analyst representing PT UPER EDUCATION TECHNOLOGY, of Jakarta. 
Analyze the provided conversation transcript between our website visitor (student/parent) and our UPER AI Assistant.
Create a highly professional lead-qualification summary structured in clear bullet points for our sales and consulting team.
Format of summary:
1. **User Background & Profile** (e.g., educational level, field of interest, location, language level - if mentioned).
2. **Specific Needs & Objectives** (what program or service they are asking for).
3. **Core Obstacles/Concerns** (e.g., questions about full/partial scholarship, budget, timeline, visa, or HSK level).
4. **Actionable Consultation Strategy** (specifically how our human advisor should contact them on WhatsApp, and what solution to offer).

Language: Please output the summary in standard Chinese and Indonesian dual-language (or clean Indonesian with clear guidance) so both Indonesian sales agents and Chinese education supervisors can review it quickly.`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout for summary

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: summaryInstruction },
              { role: 'user', content: `Analyze the following chat transcript to create the 4-section lead summary:\n\n${transcriptText}` }
            ],
            temperature: 0.3
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const resData = await response.json();
          aiSummary = (resData.choices?.[0]?.message?.content || '').trim();
        } else {
          const errBody = await response.text();
          console.warn('[SUMMARIZE ERROR] DeepSeek API returned status:', response.status, errBody);
          aiSummary = `*AI summary compilation was bypassed because DeepSeek model was temporarily busy/returned status ${response.status}. You may read the raw transcript below directly.*`;
        }
      } catch (sumErr: any) {
        console.error('[SUMMARIZE EXCEPTION]', sumErr);
        aiSummary = `*AI summary compilation was bypassed due to technical timeout/network exception. Please read the transcript history attached below instead.*`;
      }
    } else {
      aiSummary = `*User directly requested consultant contact without interactive dialogue.*`;
    }

    // Priority 2: Extract SMTP Config helper
    const { smtpUser: cleanUser, smtpPass: cleanPass, inquiryReceiver: cleanReceiver } = getSmtpConfig();

    const cleanPhoneForWa = phone.replace(/\D/g, '').replace(/^0/, '62');

    const aiSummaryFormattedHtml = aiSummary
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, '<br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    if (!cleanUser || !cleanPass) {
      console.warn('[CHATBOT INQUIRY SMTP WARNING] Gmail credentials GMAIL_USER or GMAIL_PASS are missing. Simulating delivery.');
      return res.json({
        success: true,
        simulated: true,
        summary: aiSummary,
        message: 'Lead received. Email delivery simulated because Gmail credentials (GMAIL_USER & GMAIL_PASS) are not configured in environment.'
      });
    }

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: cleanUser,
          pass: cleanPass
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      });

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #1e293b; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
            <div style="display: inline-block; padding: 8px 12px; background-color: #f0fdf4; border-radius: 20px; font-weight: 700; font-size: 12px; color: #166534; margin-bottom: 12px;">🤖 NEW AI ASSISTANT LEAD</div>
            <h2 style="color: #0f172a; font-size: 24px; margin: 0 0 6px 0; font-weight: 800; tracking: -0.025em;">UPER AI Chatbot Advisor Inquiry</h2>
            <p style="color: #64748b; margin: 0; font-size: 14px;">An active website user has filed a contact card through the AI Chat window</p>
          </div>
          
          <h3 style="color: #0c4a6e; font-size: 15px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin: 0 0 12px 0; font-weight: 700;">👤 User Contact Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; width: 35%; border-bottom: 1px solid #f1f5f9;">Full Name:</td>
              <td style="padding: 10px 0; color: #0d9488; font-weight: bold; border-bottom: 1px solid #f1f5f9;">${fullName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">WhatsApp / Mobile:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
                <a href="https://wa.me/${cleanPhoneForWa}" target="_blank" style="color: #059669; text-decoration: underline; font-weight: 700;">📞 ${phone} (Chat on WhatsApp Directly)</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Email Address:</td>
              <td style="padding: 10px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                <a href="mailto:${email}" style="color: #0284c7; text-decoration: none;">${email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Selected Consultation Program:</td>
              <td style="padding: 10px 0; color: #4f46e5; font-weight: 700; border-bottom: 1px solid #f1f5f9;">${interest}</td>
            </tr>
          </table>

          <h3 style="color: #0c4a6e; font-size: 15px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin: 0 0 12px 0; font-weight: 700;">📊 Intel AI Need Summary</h3>
          <div style="background-color: #f7fee7; border: 1px solid #d9f99d; border-radius: 12px; padding: 16px; font-size: 14px; color: #365314; line-height: 1.6; margin-bottom: 24px; font-family: inherit;">
            ${aiSummaryFormattedHtml}
          </div>

          <h3 style="color: #0c4a6e; font-size: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin: 24px 0 12px 0; font-weight: 700;">💬 Dialogue Conversation Transcript</h3>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; max-height: 250px; overflow-y: auto; font-size: 13px; color: #334155; line-height: 1.5; margin-bottom: 24px;">
            ${transcriptHtml}
          </div>

          <div style="background-color: #eff6ff; border-radius: 12px; padding: 16px; border-left: 4px solid #3b82f6; font-size: 14px; color: #1e3a8a; margin-bottom: 24px;">
            <strong>Immediate Recommendation:</strong> Please tap the emerald WhatsApp link above to connect with <strong>${fullName}</strong> directly. Review their specific concerns summarized by AI to provide a highly warm, professional, personalized study guidance!
          </div>

          <div style="text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            This dispatch was automatically prepared and analyzed by UPER Automated Intelligence Portal.
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"${fullName} via UPER AI" <${cleanUser}>`,
        to: cleanReceiver,
        replyTo: email,
        subject: `🔔 [AI Lead Report] ${fullName} (${interest}) requested consult`,
        html: htmlContent
      });

      return res.json({ success: true, summary: aiSummary });
    } catch (err: any) {
      console.error('[CHATBOT INQUIRY SMTP ERROR]', err);
      return res.status(500).json({ 
        error: 'Failed to send automated lead email', 
        details: err?.message || err 
      });
    }
  });

  mountHskAssets(app);

  app.post('/api/standalone-chat-lead', formRateLimiter, async (req, res, next) => {
    const rawFullName = req.body.fullName;
    const rawWhatsapp = req.body.whatsapp;
    const rawEmail = req.body.email;
    const rawCurrentStatus = req.body.currentStatus || 'University student';
    const rawGoal = req.body.goal || 'General Inquiry';
    const rawReportedLevel = req.body.reportedLevel || 'Beginner';
    const rawLevelState = req.body.levelState || 'PARTIAL';
    const rawCity = req.body.city || 'Jakarta';
    const rawMode = req.body.mode || 'Offline';
    const rawBuyingSignal = req.body.buyingSignal || 'None yet';
    const rawTier = req.body.tier || 'Warm-Online';
    const rawFlag = req.body.flag || 'Assessment Needed';
    const quizScore = req.body.quizScore;
    const totalQuestions = req.body.totalQuestions;
    const levelConfirmed = req.body.levelConfirmed || '';
    const quizResultSummary = req.body.quizResultSummary || '';
    const entryPoint = sanitizeInput(req.body.entryPoint || 'campus');
    const campaign = sanitizeInput(req.body.campaign || 'seminar_2026');
    const hookType = sanitizeInput(req.body.hookType || 'hsk_assessment');
    const hookContext = sanitizeInput(req.body.hookContext || 'campus_career_talk');

    if (!rawFullName || !rawWhatsapp || !rawEmail) {
      res.status(400).json({ error: 'fullName, whatsapp, and email are required.' });
      return;
    }

    const fullName = sanitizeInput(rawFullName);
    const whatsapp = sanitizeInput(rawWhatsapp);
    const email = sanitizeInput(rawEmail);
    const currentStatus = sanitizeInput(rawCurrentStatus);
    const goal = sanitizeInput(rawGoal);
    const reportedLevel = sanitizeInput(rawReportedLevel);
    const levelState = sanitizeInput(rawLevelState);
    const city = sanitizeInput(rawCity);
    const mode = sanitizeInput(rawMode);
    const buyingSignal = sanitizeInput(rawBuyingSignal);
    const tier = sanitizeInput(rawTier);
    const flag = sanitizeInput(rawFlag);

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Format email tidak valid.' });
      return;
    }

    console.log(`[STANDALONE LEAD RECEIVED] Name: ${fullName}, Tier: ${tier}, Flag: ${flag}, Goal: ${goal}, WA: ${whatsapp}, Campaign: ${campaign}`);

    const cleanPhoneForWa = whatsapp.replace(/\D/g, '').replace(/^0/, '62');
    const { smtpUser: cleanUser, smtpPass: cleanPass, inquiryReceiver: cleanReceiver } = getSmtpConfig();

    const slaTime = tier === 'Hot' ? '24 Jam (Urgent / Hot Lead)' : '48 Jam (Warm Lead)';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #1e293b; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
          <div style="display: inline-block; padding: 6px 14px; background-color: ${tier === 'Hot' ? '#fef2f2' : '#eff6ff'}; border: 1px solid ${tier === 'Hot' ? '#fca5a5' : '#bfdbfe'}; border-radius: 20px; font-weight: 800; font-size: 13px; color: ${tier === 'Hot' ? '#b91c1c' : '#1d4ed8'}; margin-bottom: 12px;">
            ${tier === 'Hot' ? '🔥 TIER: HOT (24h SLA)' : `🎯 TIER: ${tier.toUpperCase()}`} · FLAG: ${flag}
          </div>
          <h2 style="color: #0f172a; font-size: 22px; margin: 0 0 6px 0; font-weight: 800;">UPER Seminar AI Onboarding & Assessment</h2>
          <p style="color: #64748b; margin: 0; font-size: 13px;">Channel: ${entryPoint} · Campaign: ${campaign} · Hook: ${hookType} (${hookContext})</p>
        </div>
        
        <h3 style="color: #0c4a6e; font-size: 15px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin: 0 0 12px 0; font-weight: 700;">👤 Student Identity & Direct Contact</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #475569; width: 35%; border-bottom: 1px solid #f1f5f9;">Full Name:</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: bold; border-bottom: 1px solid #f1f5f9;">${fullName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">WhatsApp (One-Click):</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
              <a href="https://wa.me/${cleanPhoneForWa}?text=Halo%20${encodeURIComponent(fullName)}%2C%20saya%20konsultan%20dari%20UPER%20Education..." target="_blank" style="color: #059669; text-decoration: underline; font-weight: 700;">
                🟢 ${whatsapp} (Klik Chat WhatsApp Langsung)
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Email:</td>
            <td style="padding: 8px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;"><a href="mailto:${email}" style="color: #0284c7;">${email}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Current Status:</td>
            <td style="padding: 8px 0; color: #334155; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${currentStatus}</td>
          </tr>
        </table>

        <h3 style="color: #0c4a6e; font-size: 15px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin: 0 0 12px 0; font-weight: 700;">🎯 Core 3 Questions (Lark Sheet Alignment)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #475569; width: 35%; border-bottom: 1px solid #f1f5f9;">Goal (Tujuan):</td>
            <td style="padding: 8px 0; color: #4f46e5; font-weight: 700; border-bottom: 1px solid #f1f5f9;">${goal}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Reported Level (Tingkat):</td>
            <td style="padding: 8px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${reportedLevel} (${levelState})</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Location & Mode:</td>
            <td style="padding: 8px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">City: ${city} · Format: ${mode}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #475569; border-bottom: 1px solid #f1f5f9;">Buying Signal:</td>
            <td style="padding: 8px 0; color: ${buyingSignal !== 'None yet' ? '#dc2626' : '#64748b'}; font-weight: 700; border-bottom: 1px solid #f1f5f9;">${buyingSignal}</td>
          </tr>
        </table>

        ${quizScore !== undefined ? `
          <h3 style="color: #0c4a6e; font-size: 15px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin: 0 0 12px 0; font-weight: 700;">📊 HSK 1~3 Mixed Assessment Result</h3>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px; margin-bottom: 20px; font-size: 14px; color: #166534;">
            <p style="margin: 0 0 6px 0;"><strong>Score:</strong> ${quizScore} / ${totalQuestions} Benar</p>
            <p style="margin: 0 0 6px 0;"><strong>Confirmed Level:</strong> <span style="font-size: 16px; font-weight: bold; color: #15803d;">${levelConfirmed}</span> (Source: mixed test)</p>
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #1e3a8a; white-space: pre-wrap;">${quizResultSummary}</p>
          </div>
        ` : `
          <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 12px; margin-bottom: 20px; font-size: 13px; color: #64748b;">
            <em>Diagnostic assessment bypassed per rules (${flag}). Level classified as ${levelState}.</em>
          </div>
        `}

        <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 14px; border-radius: 8px; font-size: 13px; color: #854d0e; margin-bottom: 20px;">
          <strong>Rekomendasi Tindakan Konsultan (SLA: ${slaTime}):</strong><br/>
          ${tier === 'Hot' ? '🔥 Peserta ini memiliki minat tinggi/Buying Signal! Segera klik tautan WhatsApp di atas untuk memberikan rincian jadwal, biaya, dan penawaran seminar.' : 'Segera jadwalkan konsultasi atau undangan trial class sesuai preferensi lokasi peserta.'}
        </div>

        <div style="text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
          Dispatched by UPER Automated Seminar & AI Lead Qualification Engine.
        </div>
      </div>
    `;

    // Persist to local CRM database with full 12-category and R1-R6 rules alignment
    let savedLead = null;
    try {
      savedLead = upsertLeadFromIntake({
        fullName,
        whatsapp,
        email,
        currentStatus: currentStatus as any,
        parentContact: req.body.parentContact ? sanitizeInput(req.body.parentContact) : undefined,
        goal: goal as any,
        goals: req.body.goals,
        reportedLevel: reportedLevel as any,
        levelState: levelState as any,
        city: city as any,
        mode: mode as any,
        buyingSignal: buyingSignal as any,
        buyingSignals: req.body.buyingSignals,
        hskExamPlan: req.body.hskExamPlan ? sanitizeInput(req.body.hskExamPlan) : undefined,
        entryPoint,
        campaign,
        placement: sanitizeInput(req.body.placement || 'qr_scanner'),
        hookType: hookType as any,
        hookContext: hookContext as any,
        quizScore: typeof quizScore === 'number' ? quizScore : undefined,
        totalQuestions: typeof totalQuestions === 'number' ? totalQuestions : undefined,
        levelConfirmed: levelConfirmed ? sanitizeInput(levelConfirmed) : undefined,
        quizResultSummary: quizResultSummary ? sanitizeInput(quizResultSummary) : undefined,
        quizBreakdown: req.body.quizBreakdown,
        chatTranscript: req.body.chatTranscript
      });
      console.log(`[CRM DB SAVED] Lead ID: ${savedLead.id}, Tier: ${savedLead.tier}, Owner: ${savedLead.owner}`);
    } catch (saveErr) {
      console.error('[CRM DB SAVE ERROR]', saveErr);
    }

    if (!cleanUser || !cleanPass) {
      console.warn('[STANDALONE LEAD WARNING] Gmail credentials missing, simulating delivery.');
      return res.json({ success: true, simulated: true, tier, flag, lead: savedLead });
    }

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: cleanUser, pass: cleanPass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      });

      await transporter.sendMail({
        from: `"${fullName} (UPER Seminar AI)" <${cleanUser}>`,
        to: cleanReceiver,
        replyTo: email,
        subject: `🔔 [Seminar Lead - Tier: ${tier}] ${fullName} (${goal}) - ${whatsapp}`,
        html: htmlContent
      });

      return res.json({ success: true, tier, flag, lead: savedLead });
    } catch (err: any) {
      console.error('[STANDALONE LEAD MAIL ERROR]', err);
      return res.status(500).json({ error: 'Failed to send lead email', details: err?.message || err, lead: savedLead });
    }
  });

  // ==========================================
  // CRM & Telemarketing Workbench REST Endpoints
  // ==========================================
  app.get('/api/crm/leads', (req, res) => {
    try {
      const tier = req.query.tier as string | undefined;
      const stage = req.query.stage as string | undefined;
      const owner = req.query.owner as string | undefined;
      const search = req.query.search as string | undefined;

      const result = queryLeads({ tier, stage, owner, search });
      res.json(result);
    } catch (err: any) {
      console.error('[CRM API ERROR]', err);
      res.status(500).json({ error: 'Failed to fetch leads', details: err.message });
    }
  });

  app.get('/api/crm/leads/:id', (req, res) => {
    try {
      const lead = getLeadById(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      res.json(lead);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch lead', details: err.message });
    }
  });

  app.post('/api/crm/leads/:id/logs', express.json(), (req, res) => {
    try {
      const { staffName, channel, connectStatus, newStage, buyingSignalDetected, summary, nextAction, nextFollowUpAt } = req.body;
      if (!staffName || !channel || !connectStatus || !newStage || !summary) {
        return res.status(400).json({ error: 'staffName, channel, connectStatus, newStage, and summary are required' });
      }

      const updated = addFollowUpLog(req.params.id, {
        staffName: sanitizeInput(staffName),
        channel,
        connectStatus,
        newStage,
        buyingSignalDetected,
        summary: sanitizeInput(summary),
        nextAction: nextAction ? sanitizeInput(nextAction) : '',
        nextFollowUpAt
      });

      if (!updated) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      res.json({ success: true, lead: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to add follow-up log', details: err.message });
    }
  });

  app.patch('/api/crm/leads/:id', express.json(), (req, res) => {
    try {
      const updated = updateLeadDetails(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      res.json({ success: true, lead: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update lead', details: err.message });
    }
  });

  app.get('/api/crm/export', (req, res) => {
    try {
      const csv = generateLarkSheetCsv();
      const filename = `UPER_Leads_Lark_${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to export CSV', details: err.message });
    }
  });

  app.post('/api/crm/leads/sync-chat', express.json(), (req, res) => {
    try {
      const { whatsapp, email, leadId, messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages array is required' });
      }
      const updated = syncLeadChatMessages({ whatsapp, email, leadId }, messages);
      res.json({ success: true, updated: !!updated });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to sync chat messages', details: err.message });
    }
  });

  // CRM Policy & Cadence Configuration Endpoints
  app.get('/api/crm/policy-config', (req, res) => {
    try {
      const config = getPolicyConfig();
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to get policy config', details: err.message });
    }
  });

  app.post('/api/crm/policy-config', express.json(), (req, res) => {
    try {
      const updated = savePolicyConfig(req.body);
      res.json({ success: true, config: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to save policy config', details: err.message });
    }
  });

  app.post('/api/crm/policy-config/reset', express.json(), (req, res) => {
    try {
      const reset = resetPolicyConfig();
      res.json({ success: true, config: reset });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to reset policy config', details: err.message });
    }
  });

  // ==========================================
  // Campaign & Channel Tracking Hub Endpoints
  // ==========================================
  app.get(['/api/crm/campaigns', '/api/campaigns'], async (req, res) => {
    try {
      const campaigns = req.path.startsWith('/api/crm/')
        ? await getCurrentCampaigns(res.locals.crmEmployee)
        : loadCampaigns().map(({stats,...campaign})=>campaign);
      res.json({ success: true, campaigns });
    } catch (err: any) {
      console.error('[CAMPAIGN API ERROR] Fetch campaigns failed:', err);
      res.status(500).json({ error: 'Failed to fetch campaigns', details: err.message });
    }
  });

  app.get(['/api/crm/campaigns/:idOrCode', '/api/campaigns/:idOrCode'], async (req, res) => {
    try {
      const idOrCode = Array.isArray(req.params.idOrCode) ? req.params.idOrCode[0] : req.params.idOrCode;
      const campaigns=req.path.startsWith('/api/crm/') ? await getCurrentCampaigns(res.locals.crmEmployee) : loadCampaigns().map(({stats,...campaign})=>campaign);
      const campaign = campaigns.find(c => [c.id,c.code,c.name,c.nameEn].some(v=>v?.toLowerCase()===idOrCode.toLowerCase()));
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      res.json({ success: true, campaign });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch campaign', details: err.message });
    }
  });

  app.post('/api/crm/campaigns', express.json(), (req, res) => {
    try {
      if (!req.body || !req.body.name) {
        return res.status(400).json({ error: 'Campaign name is required' });
      }
      const saved = saveCampaign(req.body);
      res.json({ success: true, campaign: saved });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create campaign', details: err.message });
    }
  });

  app.put('/api/crm/campaigns/:id', express.json(), (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const saved = saveCampaign({ ...req.body, id });
      res.json({ success: true, campaign: saved });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update campaign', details: err.message });
    }
  });

  app.delete('/api/crm/campaigns/:id', (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const deleted = deleteCampaign(id);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete campaign', details: err.message });
    }
  });

  app.post('/api/crm/campaigns/ai-generate', express.json(), (req, res) => {
    try {
      const {
        name,
        nameEn,
        type,
        city,
        venue,
        startDate,
        startTime,
        endTime,
        targetAudience,
        keyTopics,
        organizer,
        code
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }

      const generated = synthesizeCampaignAiAssets({
        name,
        nameEn: nameEn || name,
        type: type || 'campus_seminar',
        city: city || 'Jakarta',
        venue: venue || 'TBA',
        startDate: startDate || new Date().toISOString().split('T')[0],
        startTime: startTime || '14:00',
        endTime: endTime || '16:30',
        targetAudience: Array.isArray(targetAudience) ? targetAudience : ['印尼大学生', '在职白领'],
        keyTopics: Array.isArray(keyTopics) ? keyTopics : ['HSK考级通关', '跨国名企求职'],
        organizer: organizer || 'Marketing Team',
        code: code || 'c_custom'
      });

      res.json({ success: true, aiAssets: generated });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to generate campaign AI assets', details: err.message });
    }
  });

  app.post(['/api/crm/campaigns/:idOrCode/impression', '/api/campaigns/:idOrCode/impression'], (req, res) => {
    try {
      const idOrCode = Array.isArray(req.params.idOrCode) ? req.params.idOrCode[0] : req.params.idOrCode;
      const tracked = trackCampaignImpression(idOrCode);
      res.json({ success: tracked });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to track impression', details: err.message });
    }
  });

  app.post('/api/chat', chatRateLimiter, async (req, res, next) => {
    const { messages, isHumanMode, counselorId, studentContext, stream } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }

    // Guard against excessively large chat request payloads
    if (messages.length > 100) {
      res.status(400).json({ error: 'Too many messages in history.' });
      return;
    }

    // Validate size of individual message contents
    for (const msg of messages) {
      if (msg && typeof msg.content === 'string' && msg.content.length > 5000) {
        res.status(400).json({ error: 'Individual message character length limit exceeded (5000 max).' });
        return;
      }
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;

    if (!openAiKey && !deepseekKey) {
      console.error('[AI CHAT ERROR] Neither OPENAI_API_KEY nor DEEPSEEK_API_KEY is configured.');
      return res.status(500).json({
        error: 'AI API Keys are not configured on the server. Please configure OPENAI_API_KEY or DEEPSEEK_API_KEY.'
      });
    }

    try {
      // Dynamic system instruction based on conversation mode (AI vs Human Support with multiple expert personas)
      let systemInstruction = getSystemInstruction(isHumanMode, counselorId);

      // Priority 0: Integrate Unified Student Profile & Assessment Context
      if (studentContext && typeof studentContext === 'object') {
        const lead = studentContext.leadProfile;
        const assessment = studentContext.assessment;

        let profileSummary = '\n\n### STUDENT BACKGROUND & ACADEMIC CONTEXT (已同步学生画像与测评档案):\n';
        if (lead) {
          if (lead.fullName) profileSummary += `- Student Name: ${lead.fullName}\n`;
          if (lead.goal) profileSummary += `- Target Academic Goal: ${lead.goal}\n`;
          if (lead.currentStatus) profileSummary += `- Current Status: ${lead.currentStatus}\n`;
          if (lead.reportedLevel) profileSummary += `- Self-Reported Level: ${lead.reportedLevel} (State: ${lead.levelState || 'KNOWN'})\n`;
          if (lead.levelConfirmed || assessment?.levelConfirmed) profileSummary += `- Confirmed Placement Level: ${lead.levelConfirmed || assessment?.levelConfirmed}\n`;
          if (lead.city || lead.mode) profileSummary += `- City & Preferred Mode: ${lead.city || 'Jakarta'} (${lead.mode || 'Offline'})\n`;
          if (lead.tier) profileSummary += `- Lead Tier: ${lead.tier}\n`;
        }
        if (assessment && assessment.completed) {
          profileSummary += `- HSK Placement Test: Completed (Score: ${assessment.score ?? 'N/A'}/${assessment.total ?? 15} correct)\n`;
          if (assessment.levelConfirmed) profileSummary += `- Diagnostic Confirmed Level: ${assessment.levelConfirmed}\n`;
          if (assessment.summary) profileSummary += `- Diagnostic Summary: ${assessment.summary}\n`;
        }
        profileSummary += `\nINSTRUCTION: Seamlessly tailor your explanations and course recommendations to this student's specific background, confirmed level, and academic goals. Greet them by name if appropriate, but avoid robotic repeats of their diagnostic numbers unless relevant to the discussion.`;
        systemInstruction += profileSummary;
      }

      const openAiEndpoint = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1/chat/completions';
      const openAiModel = getValidOpenAiModel(process.env.OPENAI_MODEL); // Sanitized valid OpenAI model
      const deepseekEndpoint = 'https://api.deepseek.com/chat/completions';
      const deepseekModel = 'deepseek-chat';

      // Check explicit provider preference: DEFAULT_AI_PROVIDER or AI_PRIMARY_PROVIDER ('openai' or 'deepseek')
      const explicitProvider = (process.env.DEFAULT_AI_PROVIDER || process.env.AI_PRIMARY_PROVIDER || '').toLowerCase();
      let primaryIsOpenAi = explicitProvider === 'openai' || (explicitProvider !== 'deepseek' && !!openAiKey);

      let primaryEndpoint = primaryIsOpenAi ? openAiEndpoint : deepseekEndpoint;
      let primaryKey = primaryIsOpenAi ? openAiKey : deepseekKey;
      let primaryModelName = primaryIsOpenAi ? openAiModel : deepseekModel;

      let secondaryEndpoint = primaryIsOpenAi ? deepseekEndpoint : openAiEndpoint;
      let secondaryKey = primaryIsOpenAi ? deepseekKey : openAiKey;
      let secondaryModelName = primaryIsOpenAi ? deepseekModel : openAiModel;

      if (!primaryKey && secondaryKey) {
        // Swap if primary key is missing but secondary key exists
        const tempEp = primaryEndpoint; primaryEndpoint = secondaryEndpoint; secondaryEndpoint = tempEp;
        const tempKey = primaryKey; primaryKey = secondaryKey; secondaryKey = tempKey;
        const tempMod = primaryModelName; primaryModelName = secondaryModelName; secondaryModelName = tempMod;
      }

      // Priority 2 (SSE Streaming Pipeline)
      if (stream === true) {
        const streamPromptInstruction = systemInstruction + `\n\nCRITICAL RESPONSE FORMAT INSTRUCTIONS:
Provide your complete, structured, beautifully formatted reply to the user using Markdown (paragraphs, bullet points, aligned with the user's latest query language per the LANGUAGE ALIGNMENT rule).

At the very end of your response, output a separator line:
===SUGGESTED_PROMPTS===
followed by EXACTLY 3 highly relevant, interesting, and natural follow-up questions/prompts that the student or parent might want to ask next, one per line (starting with a dash or bullet):
- Question 1
- Question 2
- Question 3

Both the reply and suggested prompts must match the user's query language 100%.`;

        const streamMessages = [
          { role: 'system', content: streamPromptInstruction },
          ...messages
            .filter((m: any) => m && m.content && m.content.trim())
            .map((m: any) => {
              const role = m.role === 'assistant' ? 'assistant' : 'user';
              let content = m.content.trim();
              if (role === 'assistant') {
                try {
                  const parsed = JSON.parse(content);
                  if (parsed && typeof parsed === 'object' && ('reply' in parsed)) {
                    content = parsed.reply;
                  }
                } catch (_) {}
              }
              return { role, content };
            })
        ];

        async function streamFromModel(endpoint: string, apiKey: string, modelName: string): Promise<boolean> {
          const controller = new AbortController();
          // A completed POST body also emits req.close. Only abort when the
          // response connection closes before we finish sending the answer.
          const onResponseClose = () => {
            if (!res.writableEnded) controller.abort();
          };
          res.on('close', onResponseClose);
          const timeoutId = setTimeout(() => controller.abort(), 60000);

          try {
            const upstreamRes = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                model: modelName,
                messages: streamMessages,
                stream: true,
                temperature: 0.3
              }),
              signal: controller.signal
            });

            if (!upstreamRes.ok || !upstreamRes.body) {
              const errBody = await upstreamRes.text().catch(() => '');
              throw new Error(`${modelName} status ${upstreamRes.status}: ${errBody}`);
            }

            if (!res.headersSent) {
              res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache, no-transform');
              res.setHeader('Connection', 'keep-alive');
              res.setHeader('X-Accel-Buffering', 'no');
              res.flushHeaders?.();
            }

            const reader = upstreamRes.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let reachedPrompts = false;
            let promptsBuffer = '';
            let pendingChunkBuffer = '';
            let upstreamCompleted = false;
            let receivedContent = false;

            const SEPARATOR = '===SUGGESTED_PROMPTS===';

            streamLoop: while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;
                const dataStr = trimmed.slice(5).trim();
                if (dataStr === '[DONE]') {
                  upstreamCompleted = true;
                  break streamLoop;
                }

                let parsed: any;
                try { parsed = JSON.parse(dataStr); } catch { continue; }
                if (parsed.error) throw new Error(`${modelName} returned a stream error`);
                {
                  const delta = parsed.choices?.[0]?.delta?.content || '';
                  if (!delta) continue;
                  receivedContent = true;

                  if (reachedPrompts) {
                    promptsBuffer += delta;
                  } else {
                    pendingChunkBuffer += delta;
                    if (pendingChunkBuffer.includes(SEPARATOR)) {
                      const [replyPart, afterPart] = pendingChunkBuffer.split(SEPARATOR);
                      if (replyPart) {
                        res.write(`data: ${JSON.stringify({ chunk: replyPart })}\n\n`);
                      }
                      reachedPrompts = true;
                      promptsBuffer = afterPart || '';
                      pendingChunkBuffer = '';
                    } else if (pendingChunkBuffer.length > SEPARATOR.length) {
                      const safeLen = pendingChunkBuffer.length - SEPARATOR.length;
                      const safeChunk = pendingChunkBuffer.slice(0, safeLen);
                      pendingChunkBuffer = pendingChunkBuffer.slice(safeLen);
                      res.write(`data: ${JSON.stringify({ chunk: safeChunk })}\n\n`);
                    }
                  }
                }
              }
            }

            if (!upstreamCompleted || !receivedContent) {
              throw new Error(`${modelName} stream ended without a complete answer`);
            }

            if (!reachedPrompts && pendingChunkBuffer) {
              res.write(`data: ${JSON.stringify({ chunk: pendingChunkBuffer })}\n\n`);
            }

            const suggestedPrompts: string[] = [];
            if (promptsBuffer) {
              const parsedLines = promptsBuffer
                .split('\n')
                .map(l => l.replace(/^[-*•\d+.\s]+/, '').trim())
                .filter(l => l.length > 0 && !l.includes('SUGGESTED_PROMPTS'));
              suggestedPrompts.push(...parsedLines.slice(0, 3));
            }

            res.write(`data: ${JSON.stringify({ done: true, suggestedPrompts, modelUsed: modelName })}\n\n`);
            res.end();
            return true;
          } finally {
            clearTimeout(timeoutId);
            res.off('close', onResponseClose);
            controller.abort();
          }
        }

        if (primaryKey) {
          try {
            console.log(`[AI CHAT STREAM] Trying primary stream (${primaryModelName})...`);
            await streamFromModel(primaryEndpoint, primaryKey, primaryModelName);
            return;
          } catch (err: any) {
            console.warn(`[AI CHAT STREAM FAILOVER] Primary model (${primaryModelName}) failed:`, err.message || err);
            if (res.destroyed || res.writableEnded) return;
            if (secondaryKey) {
              try {
                console.log(`[AI CHAT STREAM] Switching to backup stream (${secondaryModelName})...`);
                // Discard any partial primary answer before replaying with the backup.
                if (res.headersSent) res.write(`data: ${JSON.stringify({ reset: true, modelUsed: secondaryModelName })}\n\n`);
                await streamFromModel(secondaryEndpoint, secondaryKey, secondaryModelName);
                return;
              } catch (secErr: any) {
                console.error(`[AI CHAT STREAM FAILOVER] Backup stream (${secondaryModelName}) failed:`, secErr.message || secErr);
              }
            }
          }
        }

        // Fallback for complete failure
        if (res.destroyed || res.writableEnded) return;
        const fallbackMsg = `非常抱歉，当前 AI 智能咨询助手正经历高并发或网络波动，双模型备用线路均未能及时响应。\n\n您可稍后重试，或直接点击下方按钮联系雅加达招生顾问老师（+62 811-1661-2062）。\n\n*Mohon maaf, sistem sedang mengalami gangguan. Silakan hubungi konselor kami via WhatsApp (+62 811-1661-2062).*`;
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
        } else {
          res.write(`data: ${JSON.stringify({ reset: true })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ chunk: fallbackMsg })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, error: 'all_providers_failed', suggestedPrompts: ["联系 WhatsApp 顾问老师", "咨询中国大学全额奖学金", "了解 HSK 语言培训与报名"], modelUsed: null })}\n\n`);
        res.end();
        return;
      }

      // Blocking JSON Mode (Legacy & Full-payload compatibility)
      const promptInstruction = systemInstruction + `\n\nCRITICAL RESPONSE FORMAT INSTRUCTIONS:
You must respond with a JSON object containing two properties:
1. "reply": (string) Your complete, structured, beautifully formatted reply to the user (contains paragraphs/markdown, helpful bullets, in the exact same language as the user's latest query per the LANGUAGE ALIGNMENT rule).
2. "suggestedPrompts": (array of strings) EXACTLY 3 highly relevant, interesting, and natural follow-up questions/prompts that the student or parent might want to click next, based on this exact conversational state, the student's background, or the topic discussed. These prompts must be in the exact same language (e.g., Chinese, English, or Indonesian) as the reply. Keep them brief, localized, practical, and highly engaging.

CRITICAL: Return only the RAW JSON block. The chosen language for both 'reply' and 'suggestedPrompts' must match the user's query language 100%. DO NOT pack it inside Markdown wrappers or code blocks.`;

      const formattedMessages = [
        { role: 'system', content: promptInstruction },
        ...messages
          .filter((m: any) => m && m.content && m.content.trim())
          .map((m: any) => {
            const role = m.role === 'assistant' ? 'assistant' : 'user';
            let content = m.content.trim();
            if (role === 'assistant') {
              try {
                const parsed = JSON.parse(content);
                if (!parsed || typeof parsed !== 'object' || !('reply' in parsed)) {
                  content = JSON.stringify({
                    reply: content,
                    suggestedPrompts: []
                  });
                }
              } catch (_) {
                content = JSON.stringify({
                  reply: content,
                  suggestedPrompts: []
                });
              }
            }
            return { role, content };
          })
      ];

      async function callModelEndpoint(endpoint: string, apiKey: string, modelName: string) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: modelName,
              messages: formattedMessages,
              response_format: { type: 'json_object' },
              temperature: 0.3
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`${modelName} status ${response.status}: ${errBody}`);
          }
          const data = await response.json();
          const content = (data.choices?.[0]?.message?.content || '').trim();
          if (!content) {
            throw new Error(`${modelName} returned empty content`);
          }
          const parsed = JSON.parse(content);
          const reply = (parsed.reply || '').trim();
          const suggestedPrompts = parsed.suggestedPrompts || [];
          if (!reply) {
            throw new Error(`${modelName} JSON missing reply property`);
          }
          return { reply, suggestedPrompts, modelUsed: modelName };
        } catch (err: any) {
          clearTimeout(timeoutId);
          throw err;
        }
      }

      let result: { reply: string; suggestedPrompts: string[]; modelUsed: string } | null = null;
      let lastError: any = null;

      if (primaryKey) {
        try {
          console.log(`[AI CHAT] Trying primary model (${primaryModelName})...`);
          result = await callModelEndpoint(primaryEndpoint, primaryKey, primaryModelName);
        } catch (err: any) {
          lastError = err;
          console.warn(`[AI CHAT FAILOVER] Primary model (${primaryModelName}) failed:`, err.message || err);
          if (secondaryKey) {
            console.log(`[AI CHAT] Automatically switching to backup model (${secondaryModelName})...`);
            try {
              result = await callModelEndpoint(secondaryEndpoint, secondaryKey, secondaryModelName);
            } catch (secErr: any) {
              lastError = secErr;
              console.error(`[AI CHAT FAILOVER] Backup model (${secondaryModelName}) also failed:`, secErr.message || secErr);
            }
          }
        }
      }

      if (result) {
        return res.json({ reply: result.reply, suggestedPrompts: result.suggestedPrompts, modelUsed: result.modelUsed });
      }

      // Friendly, professional multi-language error response (instead of raw technical stack trace)
      console.error('[AI CHAT ERROR] All dual-model attempts failed:', lastError);
      const friendlyReply = `非常抱歉，当前 AI 智能咨询助手正经历高并发或网络波动，双模型备用线路均未能及时响应。

您可以稍后重新发送您的问题，或者直接点击下方按钮通过 WhatsApp 一对一联系我们的雅加达招生顾问老师（+62 811-1661-2062），我们将为您提供专属的留学指导与全额奖学金规划！

*Mohon maaf, asisten AI kami sedang sibuk atau mengalami gangguan jaringan. Silakan coba lagi sebentar lagi, atau hubungi konselor kami via WhatsApp (+62 811-1661-2062).*`;

      return res.json({
        reply: friendlyReply,
        suggestedPrompts: [
          "联系 WhatsApp 顾问老师",
          "咨询中国大学全额奖学金",
          "了解 HSK 语言培训与报名"
        ],
        modelUsed: getValidOpenAiModel(process.env.OPENAI_MODEL)
      });

    } catch (err: any) {
      console.error('[AI CHAT UNHANDLED ERROR]', err);
      return res.json({
        reply: `非常抱歉，系统暂时开小差了。您可以稍后重试，或直接通过 WhatsApp 联系我们的招生老师（+62 811-1661-2062）。\n\n*Mohon maaf, silakan hubungi kami via WhatsApp.*`,
        suggestedPrompts: ["联系 WhatsApp 顾问老师", "中国大学留学咨询"],
        modelUsed: getValidOpenAiModel(process.env.OPENAI_MODEL)
      });
    }
  });

  // API to get current active AI model info
  app.get('/api/ai-model-info', (req, res) => {
    try {
      const openAiKey = process.env.OPENAI_API_KEY;
      const deepseekKey = process.env.DEEPSEEK_API_KEY;
      const openAiModel = getValidOpenAiModel(process.env.OPENAI_MODEL);
      const deepseekModel = 'deepseek-chat';
      const explicitProvider = (process.env.DEFAULT_AI_PROVIDER || process.env.AI_PRIMARY_PROVIDER || '').toLowerCase();
      let primaryIsOpenAi = explicitProvider === 'openai' || (explicitProvider !== 'deepseek' && !!openAiKey);
      let activeModel = primaryIsOpenAi ? openAiModel : deepseekModel;
      if (!openAiKey && deepseekKey) {
        activeModel = deepseekModel;
      }
      res.json({
        success: true,
        activeModel,
        provider: primaryIsOpenAi ? 'openai' : 'deepseek',
        hasOpenAiKey: !!openAiKey,
        hasDeepseekKey: !!deepseekKey
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch AI model info', details: err.message });
    }
  });

  // Dynamic Sitemap.xml Generator Endpoint
  app.get('/sitemap.xml', (req, res) => {
    try {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.get('host') || 'uperedu.com';
      const baseUrl = `${protocol}://${host}`;

      const staticRoutes = [
        { path: '', priority: '1.0', changefreq: 'daily' },
        { path: '/study-abroad', priority: '0.9', changefreq: 'weekly' },
        { path: '/study-tours', priority: '0.9', changefreq: 'weekly' },
        { path: '/hsk', priority: '0.9', changefreq: 'weekly' },
        { path: '/csca', priority: '0.9', changefreq: 'weekly' },
        { path: '/partners', priority: '0.8', changefreq: 'monthly' },
        { path: '/careers', priority: '0.8', changefreq: 'monthly' },
        { path: '/contact', priority: '0.8', changefreq: 'monthly' },
        { path: '/faq', priority: '0.7', changefreq: 'monthly' },
        { path: '/crm', priority: '0.6', changefreq: 'daily' },
        { path: '/cms', priority: '0.6', changefreq: 'daily' }
      ];

      let campaignUrls: string[] = [];
      try {
        const campaigns = getEnrichedCampaigns();
        campaignUrls = campaigns.map(c => `
  <url>
    <loc>${baseUrl}/campaign/${(c as any).slug || c.code || c.id}</loc>
    <lastmod>${new Date(c.createdAt || Date.now()).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
      } catch (e) {
        // ignore
      }

      let cmsUrls: string[] = [];
      try {
        const newsItems = getCmsContent('news') || [];
        cmsUrls = newsItems.map((item: any) => `
  <url>
    <loc>${baseUrl}/news/${item.id || item.slug}</loc>
    <lastmod>${new Date(item.updatedAt || item.createdAt || Date.now()).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
      } catch (e) {
        // ignore
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticRoutes.map(route => `  <url>
    <loc>${baseUrl}${route.path}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n')}
${campaignUrls.join('\n')}
${cmsUrls.join('\n')}
</urlset>`;

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(xml.trim());
    } catch (err) {
      console.error('[SITEMAP ERROR]', err);
      res.status(500).send('Error generating sitemap.xml');
    }
  });

  // Vite integration
  if (!isProd) {
    console.log('Starting in DEVELOPMENT mode with Vite middleware');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Starting in PRODUCTION mode serving static files');
    // Priority 4 (Performance & Caching): Highly-optimized Static Caching
    app.use(express.static(distPath, {
      maxAge: '1d',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          // Do not cache HTML to ensure instant updates
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.match(/\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico)$/)) {
          // Cache fingerprinted and static assets for 1 year
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    
    // Robust SPA fallback for production (Express 5 compatible)
    app.get('*all', (req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Application not built yet. Please run npm run build.');
      }
    });
  }

  // Priority 1 & 2: Centralized express global unhandled exception and error middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[CENTRALIZED UNHANDLED ERROR HANDLER]', err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      error: process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error. Please contact technical support.' 
        : err.message || 'Internal Server Error.',
      status
    });
  });

  const server = app.listen(PORT, ['mock','local'].includes(process.env.PLATFORM_MODE || '') ? '127.0.0.1' : '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('Server failed to start:', err);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
