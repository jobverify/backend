import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SAG_INFOTECH_CATALOG = {
  source: 'saginfotech',
  companyName: 'SAG Infotech',
  officialBrandName: 'SAG Infotech',
  adapter: 'script',
  homepageUrl: 'https://saginfotech.com/',
  companyCareerPage: 'https://saginfotech.com/career.aspx',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-static-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+static-current-openings-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'saginfotech.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://saginfotech.com/career.aspx is the live first-party careers page for SAG Infotech, that it presents the heading "Current Openings", and that it exposes static opening cards with first-party apply links such as ApplyCareer.aspx?code=0023 for Tech Support Executive and ApplyCareer.aspx?code=0019 for Angular Developer.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SAG_INFOTECH_CATALOG
