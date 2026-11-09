import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TRAK_N_TELL_CATALOG = {
  source: 'trakntell',
  companyName: 'Trak N Tell',
  officialBrandName: 'Trak N Tell',
  adapter: 'script',
  homepageUrl: 'https://www.trakntell.com/',
  companyCareerPage: 'https://www.trakntell.com/',
  contactPageUrl: 'https://www.trakntell.com/contact-us/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-homepage-plus-product-contact-page-without-public-jobs-skip',
  extractionStrategy:
    'verified-first-party-homepage+verified-contact-page-without-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'trakntell.com',
  verifiedOn: '2026-09-03',
  verifiedSurfaceSummary:
    'Verified on September 3, 2026 that https://www.trakntell.com/ remained a live first-party Trak N Tell product surface centered on Experience India\'s 1st OEM GPS Vehicle Tracker, GPS Vehicle Tracker with Trak N Tell App, and Smart GPS Vehicle Tracker messaging rather than a public careers page. Verified that https://www.trakntell.com/contact-us/ remained a first-party contact page exposing Contact Us, Get In touch, care@trakntell.com, the support number 8010-80-8010, and the Gurugram address. No trustworthy public jobs surface was visible on or clearly linked from those first-party pages.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default TRAK_N_TELL_CATALOG
