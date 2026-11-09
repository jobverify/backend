import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ASCENT_HEALTH_CATALOG = {
  source: 'ascenthealth',
  companyName: 'Ascent Health',
  officialBrandName: 'Ascent Health',
  legalEntityName: 'Ascent Health Solutions Inc.',
  adapter: 'script',
  companyCareerPage: 'https://www.ascenthealthcare.com/careers/',
  homepageUrl: 'https://www.ascenthealthcare.com/',
  careersPageUrl: 'https://www.ascenthealthcare.com/careers/',
  sitemapIndexUrl: 'https://www.ascenthealthcare.com/sitemap_index.xml',
  pageSitemapUrl: 'https://www.ascenthealthcare.com/page-sitemap.xml',
  sitemapCareerRouteUrls: [
    'https://www.ascenthealthcare.com/jobs/',
    'https://www.ascenthealthcare.com/job-openings/',
    'https://www.ascenthealthcare.com/careers/',
  ],
  careerAliasRouteUrls: [
    'https://www.ascenthealthcare.com/jobs/',
    'https://www.ascenthealthcare.com/job-openings/',
    'https://www.ascenthealthcare.com/careers/jobs/',
  ],
  noPublicJobRouteUrls: [
    'https://www.ascenthealthcare.com/current-openings/',
    'https://www.ascenthealthcare.com/open-positions/',
    'https://www.ascenthealthcare.com/careers/openings/',
  ],
  atsPlatform: 'official-company-careers-nonlisting',
  countryFilter: 'India',
  paginationStrategy: 'current-corporate-careers-and-closing-hiring-entry',
  extractionStrategy:
    'current-first-party-resume-entry+closing-comparison+unknown-vacancy-inventory',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'ascenthealthcare.com',
  verifiedOn: null,
  verifiedSurfaceSummary:
    'https://www.ascenthealthcare.com/ links to the current first-party careers page at https://www.ascenthealthcare.com/careers/. A general CV entry via careers@ascent-group.com and a resume form do not identify individual vacancies, full criteria or job-owned countries. Retain bounded opening/closing hiring-entry receipts with unknown vacancy and India totals; no authoritative empty inventory or lifecycle cleanup is established.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ASCENT_HEALTH_CATALOG
