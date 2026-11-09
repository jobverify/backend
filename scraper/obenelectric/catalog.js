import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const OBEN_ELECTRIC_CATALOG = {
  source: 'obenelectric',
  companyName: 'Oben Electric',
  officialBrandName: 'Oben Electric',
  adapter: 'script',
  officialHomepageUrl: 'https://obenelectric.com/',
  officialAboutPageUrl: 'https://obenelectric.com/about-us',
  companyCareerPage: 'https://careers.obenelectric.com/jobs/Careers',
  careersApiUrl:
    'https://careers.obenelectric.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  companyDomain: 'obenelectric.com',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'official-about-page-handoff-plus-public-zoho-api',
  extractionStrategy: 'verified-about-page+verified-custom-zohorecruit-portal+public-job-openings-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'obenelectric/jobs.json',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://obenelectric.com/about-us is the official first-party Oben Electric page that exposes the Explore Careers handoff to https://careers.obenelectric.com/jobs/Careers, and that the branded public Zoho Recruit jobs API at https://careers.obenelectric.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite was live with current Oben Electric openings.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default OBEN_ELECTRIC_CATALOG
