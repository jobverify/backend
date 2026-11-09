import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MOSCHIP_TECHNOLOGIES_CATALOG = {
  source: 'moschiptechnologies',
  companyName: 'MosChip Technologies',
  officialBrandName: 'MosChip Technologies Limited',
  adapter: 'script',
  homepageUrl: 'https://moschip.com/',
  companyCareerPage: 'https://moschip.com/careers/',
  currentOpeningsUrl: 'https://moschip.com/careers/current-openings/',
  emptyJobArchiveUrl: 'https://moschip.com/job-type/full-time/',
  applicationEmail: 'careers@moschip.com',
  applicationUrl: 'mailto:careers@moschip.com',
  noPublicCareerRouteUrls: [
    'https://moschip.com/jobs/',
    'https://moschip.com/openings/',
  ],
  companyDomain: 'moschip.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy:
    'verified-careers-page-plus-current-openings-linkedin-handoff-plus-empty-job-archive-validation',
  extractionStrategy:
    'verified-careers-page+verified-current-openings-linkedin-resume-handoff+verified-empty-job-archive-and-404-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://moschip.com/careers/ links to https://moschip.com/careers/current-openings/. The page is titled Current Job Openings | MosChip but still says "Find Current Openings on..." LinkedIn, invites resumes at careers@moschip.com, and has no trustworthy public jobs surface. The adjacent https://moschip.com/job-type/full-time/, https://moschip.com/jobs/, and https://moschip.com/openings/ routes return first-party 404 pages.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MOSCHIP_TECHNOLOGIES_CATALOG
