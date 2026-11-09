import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SAAMA_TECHNOLOGIES_CATALOG = {
  source: 'saamatechnologies',
  companyName: 'Saama Technologies',
  officialBrandName: 'Saama',
  adapter: 'script',
  homepageUrl: 'https://www.saama.com/',
  companyCareerPage: 'https://www.saama.com/about/company/careers/',
  jobsBoardUrl: 'https://jobs.jobvite.com/saama/',
  atsPlatform: 'jobvite',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-handoff-plus-single-jobvite-board',
  extractionStrategy: 'verified-first-party-careers-page+jobvite-open-positions-board+india-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'saama.com',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://www.saama.com/about/company/careers/ remains the first-party Saama careers page and now embeds the public Jobvite handoff through the on-page jv-careersite widget for https://jobs.jobvite.com/saama/. The public Jobvite board is live and exposes India openings including Senior Site Reliability Engineer in Chennai, Statistical Programmer across 3 locations, and Junior Accountant - Accounts Payable (India) in Hinjewadi, Pune.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SAAMA_TECHNOLOGIES_CATALOG
