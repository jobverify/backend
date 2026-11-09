import {createVerifiedRecruitmentScraper} from '../../scraper-support/utils/verifiedRecruitment.js'
import {ZEBRA_TECHNOLOGIES_CATALOG} from './catalog.js'

// The current corporate page must name the account. Search terms and country
// facets select candidates; each full native record establishes its own facts.
export const runZebraNativeRecruitment = options => createVerifiedRecruitmentScraper({
  ...ZEBRA_TECHNOLOGIES_CATALOG,
  officialHomepageUrl: ZEBRA_TECHNOLOGIES_CATALOG.homepageUrl,
  publisherNames: ['Zebra'],
  requireNativeEmployerName: true,
  prioritizeRecruitmentSearch: true,
  preferIndiaInventory: true,
  searchIndiaWithoutFacet: true,
  allowVerifiedCorporateRedirects: true,
  discoverLiteralRecruitmentData: true,
}).run({maxDetails:80,maxRequests:80,...options})
