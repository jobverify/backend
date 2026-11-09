import {createVerifiedRecruitmentScraper} from '../../scraper-support/utils/verifiedRecruitment.js'
import {ROCKET_SOFTWARE_CATALOG} from './catalog.js'

export const runRocketNativeRecruitment = options => createVerifiedRecruitmentScraper({
  ...ROCKET_SOFTWARE_CATALOG,
  officialHomepageUrl: ROCKET_SOFTWARE_CATALOG.homepageUrl,
  prioritizeRecruitmentSearch: true,
  preferIndiaInventory: true,
  searchIndiaWithoutFacet: true,
  discoverLiteralRecruitmentData: true,
  allowVerifiedCorporateRedirects: true,
}).run(options)
