import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const K7_COMPUTING_CATALOG = {
  source: 'k7computing',
  companyName: 'K7 Computing',
  officialBrandName: 'K7 Computing',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://www.k7computing.com/',
  companyCareerPage: 'https://careers.k7computing.com/',
  companyDomain: 'k7computing.com',
  atsPlatform: 'k7-computing-first-party-careers',
  countryFilter: 'Worldwide',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+job-detail-links-or-empty-state',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedPublicPostingCount: 0,
  verifiedSurfaceSummary:
    'Verified on Thursday, August 13, 2026 that https://www.k7computing.com/us/careers still hands candidates to the first-party K7 Security careers site at https://careers.k7computing.com/. The live careers page still exposes the trusted Careers at K7 Computing and Current Openings sections, but it now truthfully states that there are currently no job openings.',
}

export default K7_COMPUTING_CATALOG
