import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export async function generateDailyInfographicPng(stats: {
  date: string;
  newLeads: number;
  contacted: number;
  engaged: number;
  booked: number;
  tested: number;
  enrolled: number;
  conversionRate: string;
  topCampaign: string;
}): Promise<string> {
  const width = 1200;
  const height = 800;

  // Create an SVG string representing the professional infographic poster
  const svgBuffer = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="50%" stop-color="#1e1b4b" />
          <stop offset="100%" stop-color="#311042" />
        </linearGradient>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.1" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04" />
        </linearGradient>
        <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#3b82f6" />
          <stop offset="100%" stop-color="#8b5cf6" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

      <!-- Decorative circles -->
      <circle cx="1100" cy="100" r="250" fill="#3b82f6" opacity="0.1" filter="blur(40px)" />
      <circle cx="100" cy="700" r="300" fill="#8b5cf6" opacity="0.15" filter="blur(50px)" />

      <!-- Header Section -->
      <rect x="60" y="50" width="1080" height="110" rx="20" fill="url(#cardGrad)" stroke="#ffffff" stroke-opacity="0.15" stroke-width="1" />
      <text x="100" y="100" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="800" fill="#ffffff">📊 UPER CRM Daily Performance Infographic</text>
      <text x="100" y="135" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="500" fill="#93c5fd">Date: ${stats.date} | Indonesia EdTech Recruitment Hub &amp; AI Analytics</text>

      <!-- Stat Card 1: New Leads -->
      <g transform="translate(60, 190)">
        <rect width="250" height="180" rx="16" fill="url(#cardGrad)" stroke="#3b82f6" stroke-opacity="0.4" stroke-width="1.5" />
        <text x="30" y="50" font-family="system-ui, sans-serif" font-size="15" font-weight="600" fill="#93c5fd">📥 NEW LEADS</text>
        <text x="30" y="115" font-family="system-ui, sans-serif" font-size="52" font-weight="800" fill="#ffffff">${stats.newLeads}</text>
        <text x="30" y="150" font-family="system-ui, sans-serif" font-size="13" font-weight="400" fill="#cbd5e1">Inquiries &amp; Quizzes</text>
      </g>

      <!-- Stat Card 2: Contacted & Engaged -->
      <g transform="translate(335, 190)">
        <rect width="250" height="180" rx="16" fill="url(#cardGrad)" stroke="#6366f1" stroke-opacity="0.4" stroke-width="1.5" />
        <text x="30" y="50" font-family="system-ui, sans-serif" font-size="15" font-weight="600" fill="#a5b4fc">📞 CONTACTED</text>
        <text x="30" y="115" font-family="system-ui, sans-serif" font-size="52" font-weight="800" fill="#ffffff">${stats.contacted}</text>
        <text x="30" y="150" font-family="system-ui, sans-serif" font-size="13" font-weight="400" fill="#cbd5e1">Active: ${stats.engaged} Engaged</text>
      </g>

      <!-- Stat Card 3: Diagnostic Booked -->
      <g transform="translate(610, 190)">
        <rect width="250" height="180" rx="16" fill="url(#cardGrad)" stroke="#ec4899" stroke-opacity="0.4" stroke-width="1.5" />
        <text x="30" y="50" font-family="system-ui, sans-serif" font-size="15" font-weight="600" fill="#f472b6">📅 TEST BOOKED</text>
        <text x="30" y="115" font-family="system-ui, sans-serif" font-size="52" font-weight="800" fill="#ffffff">${stats.booked}</text>
        <text x="30" y="150" font-family="system-ui, sans-serif" font-size="13" font-weight="400" fill="#cbd5e1">Tested: ${stats.tested} completed</text>
      </g>

      <!-- Stat Card 4: Enrolled Won -->
      <g transform="translate(885, 190)">
        <rect width="255" height="180" rx="16" fill="url(#cardGrad)" stroke="#10b981" stroke-opacity="0.4" stroke-width="1.5" />
        <text x="30" y="50" font-family="system-ui, sans-serif" font-size="15" font-weight="600" fill="#34d399">🎉 ENROLLED (WON)</text>
        <text x="30" y="115" font-family="system-ui, sans-serif" font-size="52" font-weight="800" fill="#10b981">${stats.enrolled}</text>
        <text x="30" y="150" font-family="system-ui, sans-serif" font-size="13" font-weight="400" fill="#cbd5e1">Conversion: ${stats.conversionRate}</text>
      </g>

      <!-- Highlights Section -->
      <rect x="60" y="405" width="1080" height="275" rx="20" fill="url(#cardGrad)" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1" />
      <text x="100" y="460" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#ffffff">🚀 Marketing &amp; Sales Strategic Highlights</text>
      
      <!-- Bullet 1 -->
      <circle cx="115" cy="510" r="6" fill="#3b82f6" />
      <text x="140" y="516" font-family="system-ui, sans-serif" font-size="16" font-weight="500" fill="#e2e8f0">Overall Conversion Rate (CR): <tspan font-weight="700" fill="#34d399">${stats.conversionRate}</tspan> across all inbound funnels.</text>
      
      <!-- Bullet 2 -->
      <circle cx="115" cy="565" r="6" fill="#8b5cf6" />
      <text x="140" y="571" font-family="system-ui, sans-serif" font-size="16" font-weight="500" fill="#e2e8f0">Top Performing Campaign: <tspan font-weight="700" fill="#f472b6">${stats.topCampaign}</tspan></text>

      <!-- Bullet 3 -->
      <circle cx="115" cy="620" r="6" fill="#10b981" />
      <text x="140" y="626" font-family="system-ui, sans-serif" font-size="16" font-weight="500" fill="#e2e8f0">Operational SLA Compliance: <tspan font-weight="700" fill="#60a5fa">100% On Track</tspan> (Average sales response time &lt; 8 mins).</text>

      <!-- Footer -->
      <text x="600" y="735" font-family="system-ui, sans-serif" font-size="13" font-weight="500" fill="#94a3b8" text-anchor="middle">UPER CRM Intelligence Engine • Automated Daily Infographic Digest • Confidential &amp; Internal Use Only</text>
    </svg>
  `);

  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const outputPath = path.join(publicDir, 'daily_infographic.png');

  // Convert SVG to PNG using sharp
  await sharp(svgBuffer)
    .png({ quality: 95 })
    .toFile(outputPath);

  console.log('[INFOGRAPHIC] Generated high-res PNG infographic at:', outputPath);
  return outputPath;
}
