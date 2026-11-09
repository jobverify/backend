import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SARVAGRAM_CATALOG = {
  source: 'sarvagram',
  companyName: 'SarvaGram',
  officialBrandName: 'SarvaGram',
  adapter: 'script',
  homepageUrl: 'https://www.sarvagram.com/',
  aboutPageUrl: 'https://www.sarvagram.com/about-us/',
  companyCareerPage: 'https://sarvagram.zohorecruit.in/jobs/Careers',
  careersPortalUrl: 'https://sarvagram.zohorecruit.in/jobs/Careers',
  careersApiUrl: 'https://sarvagram.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  careersDetailHost: 'sarvagram.zohorecruit.in',
  companyDomain: 'sarvagram.com',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'public-zohorecruit-api',
  extractionStrategy: 'verified-zohorecruit-careers-portal+public-zohorecruit-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that the public SarvaGram careers portal at https://sarvagram.zohorecruit.in/jobs/Careers and its public Zoho Recruit API at https://sarvagram.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite are live and expose 10 India jobs, including Senior System Admin, Senior Frontend Engineer - React, and Associate Product Manager. Direct fetches of https://www.sarvagram.com/about-us/ now return HTTP 403 in this environment, so the scraper no longer blocks on that legacy handoff page.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'sarvagram/jobs.json',
}

export default SARVAGRAM_CATALOG
