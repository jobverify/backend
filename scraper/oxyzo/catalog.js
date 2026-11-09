import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const OXYZO_CATALOG = {
  source: 'oxyzo',
  companyName: 'Oxyzo',
  officialBrandName: 'Oxyzo Financial Services Ltd',
  adapter: 'script',
  homepageUrl: 'https://www.oxyzocareers.in/',
  companyCareerPage: 'https://www.oxyzocareers.in/categories',
  officialCareersPageUrl: 'https://www.oxyzocareers.in/categories',
  jobPagePrefix: 'https://www.oxyzocareers.in/jobs/',
  paginationQueryParam: 'comp-lyh6vd88_page',
  companyDomain: 'oxyzo.in',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'numbered-query-param-pages-until-empty',
  extractionStrategy: 'verified-first-party-categories-pages+first-party-job-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.oxyzocareers.in/ was the live official Oxyzo careers homepage, that the first-party listing surface at https://www.oxyzocareers.in/categories publicly exposed current role cards and direct first-party detail URLs under https://www.oxyzocareers.in/jobs/, and that the live board paginated across pages 1 through 4 while page 5 was the first empty listing page. The verified live board exposed 11 unique official job detail URLs on that date, including roles such as Area Sales Manager - SME Lending, Business Development Manager, Sales Manager - MSME LAP, and Zonal Head - Employee Relations (South).',
  dryRunFile: 'oxyzo/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default OXYZO_CATALOG
