import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MOKOBARA_CATALOG = {
  source: 'mokobara',
  companyName: 'Mokobara',
  officialBrandName: 'Mokobara Lifestyle Private Limited',
  adapter: 'script',
  homepageUrl: 'https://mokobara.com/',
  companyCareerPage: 'https://mokobara.com/apps/frequently-asked-questions',
  faqUrl: 'https://mokobara.com/apps/frequently-asked-questions',
  applicationEmail: 'careers@mokobara.com',
  applicationUrl: 'mailto:careers@mokobara.com',
  noPublicCareerRouteUrls: [
    'https://mokobara.com/pages/careers',
    'https://mokobara.com/careers',
  ],
  companyDomain: 'mokobara.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-footer-plus-faq-email-plus-careers-route-validation',
  extractionStrategy:
    'verified-homepage-footer+verified-faq-email-handoff+verified-no-public-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://mokobara.com/ is the live first-party Mokobara surface, that its footer includes "Join our team! - careers@mokobara.com", and that the legal footer identifies Mokobara Lifestyle Private Limited. Verified that https://mokobara.com/apps/frequently-asked-questions contains the first-party hiring answer "How do I join the Mokobara team?" followed by "Shoot your shot with us at careers@mokobara.com!". Verified that https://mokobara.com/pages/careers returned 404 and that https://mokobara.com/careers resolved back to the homepage rather than a public jobs board. There is no trustworthy public jobs surface for Mokobara on the verified date.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MOKOBARA_CATALOG
