import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AMANTRA_CATALOG = {
  source: 'amantra',
  companyName: 'Amantra',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.amantra.ai/careers',
  homepageUrl: 'https://www.amantra.ai/',
  sitemapUrl: 'https://www.amantra.ai/sitemap.xml',
  applicationEmail: 'careers@amantra.ai',
  companyDomain: 'amantra.ai',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-sitemap-role-discovery',
  extractionStrategy:
    'verified-homepage+verified-careers-page+verified-sitemap-role-set+first-party-detail-pages+email-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedRoleUrls: [
    'https://www.amantra.ai/careers/technical-project-manager',
    'https://www.amantra.ai/careers/engineering-manager',
    'https://www.amantra.ai/careers/business-development-executive-(bde)',
    'https://www.amantra.ai/careers/qa-manual',
    'https://www.amantra.ai/careers/business-development-manager-(bdm)',
    'https://www.amantra.ai/careers/full-stack-developer',
    'https://www.amantra.ai/careers/nodejs-developer',
  ],
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.amantra.ai/ is the live first-party Amantra AI homepage, that https://www.amantra.ai/careers is the live first-party careers page, that https://www.amantra.ai/sitemap.xml publishes the same seven role-detail URLs currently linked from the careers page including https://www.amantra.ai/careers/technical-project-manager, and that the role pages use first-party /careers/* detail pages with location, work-mode, employment-type, and email-apply instructions pointing applicants to careers@amantra.ai.',
}

export default AMANTRA_CATALOG
