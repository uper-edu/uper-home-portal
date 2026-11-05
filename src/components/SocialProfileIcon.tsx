export const socialProfiles = {
  whatsapp: { name: 'WhatsApp', url: 'https://wa.me/6281116612062' },
  instagram: { name: 'Instagram', url: 'https://www.instagram.com/uper.education/' },
  threads: { name: 'Threads', url: 'https://www.threads.com/@upereducationtech' },
  facebook: { name: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61566249203241' },
  tiktok: { name: 'TikTok', url: 'https://www.tiktok.com/@upereducation' },
  youtube: { name: 'YouTube', url: 'https://www.youtube.com/@UperEducation' },
  linkedin: { name: 'LinkedIn', url: 'https://www.linkedin.com/company/pt-uper-education-technology/' },
} as const;

export function SocialProfileIcon({
  platform,
  className,
}: {
  platform: keyof typeof socialProfiles;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className={className}>
      {platform === 'whatsapp' ? (
        <>
          <path
            fillRule="evenodd"
            d="M12 1a11 11 0 0 0-9.5 16.5L1 23l5.6-1.5A11 11 0 1 0 12 1Zm0 2a9 9 0 1 1-4.6 16.8l-.4-.2-3.2.8.9-3.1-.3-.4A9 9 0 0 1 12 3Z"
          />
          <path d="M8.2 6.6c-.3-.1-.6 0-.9.3-.6.6-.9 1.3-.8 2.2.2 2.8 3.7 6.5 7 7.3 1.2.3 2.4-.3 2.8-.9.2-.4.4-1.1.2-1.4l-2.3-1.2c-.3-.1-.4 0-.6.2l-.9 1c-.2.2-.4.2-.7 0a9 9 0 0 1-3.3-3c-.2-.3-.2-.4 0-.6l.7-.9c.2-.2.2-.4.1-.6L8.5 7c-.1-.2-.1-.4-.3-.4Z" />
        </>
      ) : platform === 'instagram' ? (
        <>
          <g fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
          </g>
          <circle cx="17.5" cy="6.5" r="1.2" />
        </>
      ) : platform === 'threads' ? (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 7C18.8 3.5 16.2 2 12 2 5.5 2 3 6 3 12s2.5 10 9 10c5.2 0 8-2.8 8-6.2 0-3.6-3.2-5.6-7.3-5.6-3.1 0-5 1.4-5 3.6 0 1.8 1.4 3 3.4 3 3.2 0 4.8-2.2 4.8-5.3 0-3-1.5-4.7-4.1-4.7-1.7 0-3 .7-3.8 1.9"
        />
      ) : platform === 'facebook' ? (
        <path d="M14 22v-9h3l.5-3H14V8c0-.9.3-1.5 1.5-1.5H18V3.2c-.4-.1-1.8-.2-3.3-.2C11.4 3 9 5 9 8.7V10H6v3h3v9h5Z" />
      ) : platform === 'tiktok' ? (
        <path d="M16.6 1h-4v14.2a3.1 3.1 0 1 1-2.7-3.1V8a7.2 7.2 0 1 0 6.8 7.2V8.1a10 10 0 0 0 5.3 1.6V5.6A6.1 6.1 0 0 1 16.6 1Z" />
      ) : platform === 'linkedin' ? (
        <>
          <circle cx="5" cy="5" r="2" />
          <path d="M3 9h4v12H3zM10 9h4v1.6c.8-1.2 2-1.9 3.5-1.9 3 0 4.5 1.8 4.5 5.3v7h-4v-6.4c0-1.7-.5-2.5-1.8-2.5-1.5 0-2.2 1-2.2 2.8V21h-4z" />
        </>
      ) : (
        <path
          fillRule="evenodd"
          d="M23 7s-.2-1.7-.9-2.4c-.9-.9-1.9-.9-2.4-1C16.4 3.3 12 3.3 12 3.3s-4.4 0-7.7.3c-.5.1-1.5.1-2.4 1C1.2 5.3 1 7 1 7S.7 9 .7 11v2c0 2 .3 4 .3 4s.2 1.7.9 2.4c.9.9 2.1.9 2.7 1 2 .2 7.4.3 7.4.3s4.4 0 7.7-.3c.5-.1 1.5-.1 2.4-1 .7-.7.9-2.4.9-2.4s.3-2 .3-4v-2c0-2-.3-4-.3-4Z M9.7 8.2l6 3.8-6 3.8Z"
        />
      )}
    </svg>
  );
}
