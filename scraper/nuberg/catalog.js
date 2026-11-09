import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NUBERG_CATALOG = {
  source: 'nuberg',
  companyName: 'Nuberg',
  officialBrandName: 'Nuberg EPC',
  adapter: 'script',
  homepageUrl: 'https://www.nubergepc.com/',
  companyCareerPage: 'https://www.nubergepc.com/career.html',
  officialApplicationFormAnchor: '#career-form-section',
  officialResumeSubmissionEmail: 'recruit@nuberg.in',
  atsPlatform: 'official-company-site',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-html-opportunities-page',
  extractionStrategy:
    'verified-first-party-careers-page+inline-current-opportunities-blocks+mailto-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'nubergepc.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.nubergepc.com/career.html is the live first-party Nuberg EPC careers page for the backlog company Nuberg. The page exposes a Current Opportunities section with visible public openings such as Process Lead / Engineer, Project Manager, and PR Executive - Marketing, plus same-page Application Form and mailto apply links to recruit@nuberg.in.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default NUBERG_CATALOG
