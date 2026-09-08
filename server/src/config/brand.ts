import 'dotenv/config';

export const BRAND = {
  name: 'CandidFan',
  domain: 'https://candidfan.com',
  mediaDomain: process.env.MEDIA_PUBLIC_URL || 'https://media.candidfan.com',
  offer: {
    amountMinor: 5000,
    currency: 'EUR',
    label: '€50',
    purchaseUrl: 'https://www.g2a.com/rewarble-visa-gift-card-50-eur-by-rewarble-key-global-i10000502992084',
  },
  sender: process.env.SMTP_FROM || 'CandidFan <hello@candidfan.com>',
};
