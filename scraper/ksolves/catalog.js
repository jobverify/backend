import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KSOLVES_CATALOG = {
  source: 'ksolves',
  companyName: 'Ksolves',
  officialBrandName: 'Ksolves',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.ksolves.com/careers',
  homepageUrl: 'https://www.ksolves.com/',
  verifiedRoleUrls: [
    'https://www.ksolves.com/careers-form?jobid=1&jobtitle=+Full+Stack+Developer+%28React+Native%2C+ReactJS%2C+Python%29',
    'https://www.ksolves.com/careers-form?jobid=6&jobtitle=Senior+Software+Engineer+%28Data%29',
  ],
  companyDomain: 'ksolves.com',
  atsPlatform: 'official-company-site',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-openings-page-plus-first-party-detail-pages',
  extractionStrategy:
    'verified-careers-page+listing-cards-with-data-location-and-jobtype+detail-pages-with-job-meta-and-inline-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'ksolves/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that the official Ksolves homepage at https://www.ksolves.com/ links to the first-party careers index at https://www.ksolves.com/careers, where live listing cards link directly to first-party role pages under https://www.ksolves.com/careers-form. Verified detail pages for Full Stack Developer (React Native, ReactJS, Python) and Senior Software Engineer (Data) expose title, Location, Experience, Work Mode, role content, and an Apply for This Job form on the same first-party domain.',
}

export default KSOLVES_CATALOG
