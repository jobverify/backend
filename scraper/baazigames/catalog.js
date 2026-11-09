import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BAAZI_GAMES_CATALOG = {
  source: 'baazigames',
  companyName: 'Baazi Games',
  adapter: 'script',
  companyCareerPage: 'https://www.baazigames.com/',
  companyDomain: 'baazigames.com',
  contactPageUrl: 'https://www.baazigames.com/contact-us/',
  careersRouteUrl: 'https://www.baazigames.com/careers/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-contact-page-plus-blocked-careers-route-validation',
  extractionStrategy: 'verified-homepage+verified-contact-page+talent-email-only+blocked-careers-route-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://www.baazigames.com/ remained the exact-name first-party Baazi Games site, that https://www.baazigames.com/contact-us/ exposed only a talent-acquisition contact surface at talent.acquisition@moonshinetechnology.com, and that the adjacent /careers/ route still returned an AccessDenied response instead of a trustworthy public jobs board. Because no public first-party openings feed was exposed on the verified date, this provider fails closed.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default BAAZI_GAMES_CATALOG
