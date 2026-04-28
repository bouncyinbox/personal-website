// Site-wide configuration. Edit values, not call sites.

export const SITE = {
  domain: 'buildwithamit.in',
  url: 'https://buildwithamit.in',
  title: 'Amit Kumar',
  tagline: 'Senior Engineering Manager · Bangalore, India',
  description:
    'Amit Kumar — Senior Engineering Manager in Bangalore with 13+ years scaling engineering teams across e-commerce, payments, travel, and marketplace platforms (Nielsen, Myntra, Snapdeal, RedBus). Writing on engineering leadership, distributed systems, and AI-assisted development.',
  jobTitle: 'Senior Engineering Manager',
  author: 'Amit Kumar',
  // Lightly obfuscated email parts; assembled at render time.
  emailUser: 'bouncyinbox',
  emailDomain: 'gmail.com',
  linkedin: 'https://www.linkedin.com/in/amitk0mar',
  github: 'https://github.com/bouncyinbox',
  twitter: 'https://x.com/amit_k0mar',
  twitterHandle: '@amit_k0mar',
  medium: 'https://medium.com/@humptytech',
  socialLabel: 'LinkedIn',
  socialUrl: 'https://www.linkedin.com/in/amitk0mar',
  city: 'Bangalore',
  region: 'Karnataka',
  country: 'India',
  defaultOgImage: '/og-default.png',
  profileImage: '/profile.jpeg',
  keywords: [
    'Amit Kumar',
    'Senior Engineering Manager',
    'Engineering Manager Bangalore',
    'engineering leadership',
    'distributed systems',
    'microservices at scale',
    'e-commerce engineering',
    'platform reliability',
    'developer productivity',
    'AI-assisted development',
  ],
  alumniOf: ['Nielsen', 'Myntra', 'Snapdeal', 'RedBus'],
} as const;

// Toggle Plausible Analytics. Off by default; flip to true when ready.
export const PLAUSIBLE_ENABLED = false;
export const PLAUSIBLE_DOMAIN = SITE.domain;
