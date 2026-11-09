import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TOPCODER_INDIA_CATALOG = {
  source: 'topcoderindia',
  companyName: 'Topcoder India',
  officialBrandName: 'Topcoder',
  adapter: 'script',
  companyCareerPage: 'https://www.topcoder.com/community/tcgigs',
  homepageUrl: 'https://www.topcoder.com/',
  gigProgramUrl: 'https://www.topcoder.com/community/member-programs/gigs',
  gigResourcesUrl: 'https://www.topcoder.com/community/gig-resources',
  companyDomain: 'topcoder.com',
  atsPlatform: 'first-party-gig-marketplace-no-exact-name-employer-surface',
  countryFilter: 'India',
  paginationStrategy:
    'verified-first-party-gig-pages-without-exact-name-topcoder-india-employer-feed',
  extractionStrategy:
    'verified-first-party-homepage+gig-work-landing+gig-program+gig-transfer-update-without-exact-name-employer-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.topcoder.com/ is the live Topcoder homepage describing a crowd-driven human + AI talent platform, that https://www.topcoder.com/community/tcgigs is the first-party Gig Work landing page saying opportunities are open to folks around the world and that location does not matter even though the page says Topcoder also needs folks in the USA and India, and that https://www.topcoder.com/community/member-programs/gigs defines Gig Work as a full time, freelance position working directly with customers rather than an exact-name Topcoder India employer feed. Verified on Friday, July 17, 2026 that https://www.topcoder.com/community/gig-resources says Topcoder gig management was transferred to Wipro and points gig questions to talent.topcoder@wipro.com. Those verified first-party surfaces expose a global freelance marketplace, with no trustworthy exact-name Topcoder India employer jobs surface or ATS handoff.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default TOPCODER_INDIA_CATALOG
