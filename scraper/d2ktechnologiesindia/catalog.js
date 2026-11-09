import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const D2K_TECHNOLOGIES_INDIA_CATALOG = {
  source: 'd2ktechnologiesindia',
  companyName: 'D2K Technologies India',
  officialBrandName: 'D2K Technologies India Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://www.d2ktechnologies.com/',
  companyCareerPage: 'https://www.d2ktechnologies.com/careerold.html',
  companyDomain: 'd2ktechnologies.com',
  atsPlatform: 'official-company-site-job-cards',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+same-page-job-cards+same-domain-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-09-13',
  verifiedSurfaceSummary:
    'Verified on Sunday, September 13, 2026 that the former https://www.d2ktechnologies.com/careers route returns HTTP 404 while https://www.d2ktechnologies.com/careerold.html is a live first-party D2K Technologies India careers page. It publicly lists role cards such as MSBI Developer, SQL Developer, Software Developer, Business Analyst, Software Tester, Android Developer, and Python Developer, and each card links to a same-domain apply route on www.d2ktechnologies.com. The current role cards and inspected MSBI detail do not provide job geography; the registered office is not a job location. Unverified role locations now produce an explicit upstream-unavailable result and preserve previous jobs.',
  dryRunFile: 'd2ktechnologiesindia/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default D2K_TECHNOLOGIES_INDIA_CATALOG
