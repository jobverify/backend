import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BEO_SOFTWARE_CATALOG = {
  source: 'beosoftware',
  companyName: 'BEO Software',
  officialBrandName: 'BEO Software',
  adapter: 'script',
  companyCareerPage: 'https://beo-software.in/careers',
  companyDomain: 'beo-software.in',
  atsPlatform: 'official-first-party-job-cards',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+same-page-job-list+first-party-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://beo-software.in/careers remained the live first-party BEO Software jobs page and now rendered the opening list inside a search-results list with direct first-party detail links under /careers-jobs-detail/. The verified page publicly listed roles such as Senior Full-Stack Node.js Developer, Senior Full-Stack Developer, Senior Full Stack Developer (Python , React , Vite), and Senior Frontend Developer (Angular / TypeScript / SCSS), with Location : Kochi and posted dates such as 31-07-2026 and 29-04-2026.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default BEO_SOFTWARE_CATALOG
