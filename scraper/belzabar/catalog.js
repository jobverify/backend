import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 19, 2026 that https://www.belzabar.com/ is the live first-party homepage for Belzabar Software and it links Careers to https://www.belzabar.com/about/life-at-belzabar#careers-section. Verified that the canonical careers route https://www.belzabar.com/about/life-at-belzabar serves the published Belzabar careers content with an Open Positions list linking to same-domain detail pages including https://www.belzabar.com/jobs/senior-infrastructure-engineer-linux, https://www.belzabar.com/jobs/qa-engineer, https://www.belzabar.com/jobs/front-end-developer, and https://www.belzabar.com/jobs/senior-computer-scientist-java. Verified the detail pages are live and expose the role content plus a same-page Apply form surface.'

export const BELZABAR_CATALOG = {
  source: 'belzabar',
  companyName: 'Belzabar',
  officialBrandName: 'Belzabar Software Design India Pvt Ltd',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'belzabar/jobs.json',
  companyCareerPage: 'https://www.belzabar.com/about/life-at-belzabar',
  homepageUrl: 'https://www.belzabar.com/',
  homepageLinkedCareersUrl: 'https://www.belzabar.com/about/life-at-belzabar#careers-section',
  canonicalCareersUrl: 'https://www.belzabar.com/about/life-at-belzabar',
  companyDomain: 'belzabar.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-link-plus-canonical-careers-page-and-detail-pages',
  extractionStrategy:
    'verified-homepage+verified-canonical-careers-page+same-domain-job-detail-pages+same-page-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default BELZABAR_CATALOG
