import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SCALEFUSION_CATALOG = {
  source: 'scalefusion',
  companyName: 'Scalefusion',
  officialBrandName: 'Scalefusion',
  adapter: 'script',
  companyCareerPage: 'https://scalefusion.com/careers/',
  officialCareersPageUrl: 'https://scalefusion.com/careers/',
  officialCareersHandoffUrl: 'https://promobitech.com/careers',
  verifiedJobListingPageUrl: 'https://promobitech.com/careers',
  companyDomain: 'scalefusion.com',
  atsPlatform: 'official-company-careers-handoff-parent-site',
  countryFilter: 'India',
  verifiedPublicJobCount: 7,
  verifiedSampleJobTitle: 'Ruby On Rails Developer',
  verifiedSampleSecondaryJobTitle: 'Senior Product Engineer - Golang',
  paginationStrategy: 'verified-exact-name-careers-handoff-plus-single-parent-company-open-positions-page',
  extractionStrategy:
    'verified-exact-name-careers-page+verified-parent-company-careers-handoff+parent-company-open-position-cards+public-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://scalefusion.com/careers/ is the live exact-name first-party Scalefusion careers page, that it explicitly states Scalefusion is a product of ProMobi Technologies Pvt. Ltd, and that its View job openings CTA hands candidates to the live parent-company openings page at https://promobitech.com/careers. The verified parent-company public jobs surface was live with seven openings including Ruby On Rails Developer and Senior Product Engineer - Golang on the verified date, so this exact-name provider conservatively extracts the public ProMobi openings exposed by the official Scalefusion careers handoff.',
  dryRunFile: 'scalefusion/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SCALEFUSION_CATALOG
