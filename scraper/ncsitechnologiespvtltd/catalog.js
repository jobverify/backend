import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NCSI_TECHNOLOGIES_PVT_LTD_CATALOG = {
  source: 'ncsitechnologiespvtltd',
  companyName: 'NCSI Technologies Pvt Ltd',
  officialBrandName: 'NCSi',
  adapter: 'script',
  homepageUrl: 'https://www.ncsi.us/',
  companyCareerPage: 'https://www.ncsi.us/careers/',
  atsPlatform: 'first-party-generic-careers-landing-no-trustworthy-exact-name-jobs-surface',
  countryFilter: 'India',
  paginationStrategy: 'fail-closed-sentinel',
  extractionStrategy: 'verified-generic-careers-landing-without-exact-name-india-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'ncsi.us',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.ncsi.us/careers/ is the live official NCSi careers landing page with generic recruiting copy such as "YOUR CAREER. OUR COMMITMENT.", but this page does not expose a trustworthy exact-name India jobs board for the backlog company NCSI Technologies Pvt Ltd. This provider therefore stays fail-closed and returns an empty list until an exact-name public jobs surface is confirmed.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default NCSI_TECHNOLOGIES_PVT_LTD_CATALOG
