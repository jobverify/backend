import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ARKA_FINCAP_CATALOG = {
  source: 'arkafincap',
  companyName: 'Arka Fincap',
  officialBrandName: 'Arka Fincap',
  adapter: 'script',
  companyCareerPage: 'https://www.arkafincap.com/life-at-arka',
  homepageUrl: 'https://www.arkafincap.com/',
  careersPageUrl: 'https://www.arkafincap.com/life-at-arka',
  careersPortalUrl: 'https://arkafincap.zohorecruit.in/jobs/Careers',
  careersApiUrl:
    'https://arkafincap.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-handoff-plus-public-zoho-api',
  extractionStrategy: 'official-careers-page+branded-zohorecruit-portal+public-job-openings-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'arkafincap.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.arkafincap.com/ links its first-party Life at Arka careers experience at https://www.arkafincap.com/life-at-arka, which hands off to the branded public Zoho Recruit portal at https://arkafincap.zohorecruit.in/jobs/Careers backed by https://arkafincap.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite and was live with a Data Architect opening in India.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ARKA_FINCAP_CATALOG
