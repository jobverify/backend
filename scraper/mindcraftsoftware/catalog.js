import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MINDCRAFT_SOFTWARE_CATALOG = {
  source: 'mindcraftsoftware',
  companyName: 'MindCraft Software',
  officialBrandName: 'MindCraft',
  adapter: 'script',
  homepageUrl: 'https://www.mindcraftamerica.com/',
  companyCareerPage: 'https://www.mindcraftamerica.com/careers/',
  officialCareersPageUrl: 'https://www.mindcraftamerica.com/careers/',
  companyDomain: 'mindcraftamerica.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-public-page',
  extractionStrategy: 'verified-careers-shell+resume-form-without-public-role-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.mindcraftamerica.com/careers/ was the live first-party MindCraft careers page and that it exposed an Apply Now resume-submission shell with recruitment@mindcraft.com, but no trustworthy public jobs surface with visible role rows, detail links, or machine-readable listings.',
  dryRunFile: 'mindcraftsoftware/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MINDCRAFT_SOFTWARE_CATALOG
