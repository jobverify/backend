import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GUPSHUP_CATALOG = {
  source: 'gupshup',
  companyName: 'Gupshup',
  officialBrandName: 'Gupshup',
  adapter: 'script',
  homepageUrl: 'https://www.gupshup.ai/en/',
  companyCareerPage: 'https://www.gupshup.ai/en/careers',
  aboutUsUrl: 'https://www.gupshup.ai/about-us',
  officialCareersHandoffUrl:
    'https://api.whatsapp.com/send?app_absent=0&phone=+919873865178&text=Hi+&type=phone_number',
  businessContactEmail: 'sales@gupshup.ai',
  companyDomain: 'gupshup.ai',
  atsPlatform: 'official-company-site-whatsapp-handoff-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-plus-whatsapp-handoff-validation',
  extractionStrategy: 'verified-first-party-careers-page+about-page+whatsapp-handoff-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.gupshup.ai/en/careers was the official Gupshup careers page, carrying Join Gupshup global-team copy, the sales@gupshup.ai contact marker, and an Explore Opportunities handoff to https://api.whatsapp.com/send?app_absent=0&phone=+919873865178&text=Hi+&type=phone_number instead of a public ATS. https://www.gupshup.ai/about-us remained a trustworthy first-party company page with Born in India narrative plus 900 Strong global team and 12 Global offices language. No trustworthy public jobs surface was verifiable for exact-name Gupshup on Friday, July 17, 2026.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default GUPSHUP_CATALOG
