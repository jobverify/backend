import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EXIDE_INDUSTRIES_CATALOG = {
  source: 'exideindustries',
  companyName: 'Exide Industries',
  officialBrandName: 'Exide Industries Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'exideindustries/jobs.json',
  homepageUrl: 'https://www.exideindustries.com/',
  officialCareerLandingUrl: 'https://careers.exideindustries.com/',
  companyCareerPage: 'https://careers.exideindustries.com/current-vacancy.aspx',
  currentVacancyUrl: 'https://careers.exideindustries.com/current-vacancy.aspx',
  dropCvUrl: 'https://careers.exideindustries.com/drop-cv.aspx',
  externalJobsHost: 'www.naukri.com',
  companyDomain: 'exideindustries.com',
  atsPlatform: 'official-company-site-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy:
    'verified-homepage-plus-careers-shell-plus-contradictory-current-vacancy-handoff',
  extractionStrategy:
    'verified-homepage+verified-careers-shell+verified-contradictory-current-vacancy-naukri-handoff+verified-drop-cv-form+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.exideindustries.com/ is the live first-party Exide Industries homepage and that its visible CAREERS link points to https://careers.exideindustries.com/. Verified that https://careers.exideindustries.com/ is the live first-party careers shell, and that https://careers.exideindustries.com/current-vacancy.aspx simultaneously shows the no-jobs copy "We could not find you any jobs." while also rendering visible www.naukri.com job handoff links plus a same-domain Drop CV link to https://careers.exideindustries.com/drop-cv.aspx. Verified that https://careers.exideindustries.com/drop-cv.aspx exposes only the resume-upload form. Because the verified first-party surface is contradictory and handoff-based, there is no trustworthy public jobs surface for exact-name Exide Industries on the verified date.',
}

export default EXIDE_INDUSTRIES_CATALOG
