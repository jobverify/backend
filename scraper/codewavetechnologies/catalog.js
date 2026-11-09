import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CODEWAVE_TECHNOLOGIES_CATALOG = {
  source: 'codewavetechnologies',
  companyName: 'Codewave Technologies',
  officialBrandName: 'Codewave',
  adapter: 'script',
  companyCareerPage: 'https://codewave.com/careers/',
  companyDomain: 'codewave.com',
  atsPlatform: 'first-party-html-job-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-listing-page-plus-detail-pages',
  extractionStrategy: 'verified-first-party-careers-page+paginated-opening-rows+company-hosted-apply-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://codewave.com/careers/ remained the live first-party Codewave careers page, paginated the public openings across /careers/, /careers/?cwpage=2, and /careers/?cwpage=3, and listed roles including Quality Builder: Web & Cross-Platform, Product Owner: Vision & Delivery, Infra Builder: Senior DevOps & Cloud, and AI Builder: Models & Agents in Bangalore. Verified the linked first-party role pages exposed Full time Bangalore detail blocks and company-hosted Apply for this job links such as https://codewave.com/en/apply?job_id=35572.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'codewavetechnologies/jobs.json',
}

export default CODEWAVE_TECHNOLOGIES_CATALOG
