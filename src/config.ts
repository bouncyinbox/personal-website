// Site-wide configuration. Edit values, not call sites.

export const SITE = {
  // PLACEHOLDER domain — replace with your real domain.
  domain: 'amitkumar.dev',
  url: 'https://amitkumar.dev',
  title: 'Amit Kumar',
  description:
    'Personal site of Amit Kumar, Senior Engineering Manager.',
  author: 'Amit Kumar',
  // Lightly obfuscated email parts; assembled at render time.
  emailUser: 'bouncyinbox',
  emailDomain: 'gmail.com',
  linkedin: 'https://www.linkedin.com/in/amitk0mar',
  github: 'https://github.com/bouncyinbox',
  // Pick X / Bluesky / Mastodon later; leave generic.
  socialLabel: 'LinkedIn',
  socialUrl: 'https://www.linkedin.com/in/amitk0mar',
  city: 'Bangalore, India',
  defaultOgImage: '/og-default.png',
} as const;

// Toggle Plausible Analytics. Off by default; flip to true when ready.
export const PLAUSIBLE_ENABLED = false;
export const PLAUSIBLE_DOMAIN = SITE.domain;
