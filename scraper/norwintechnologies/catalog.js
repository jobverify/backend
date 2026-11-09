import { fileURLToPath } from 'node:url'

const modulePath = fileURLToPath(new URL('./script.js', import.meta.url))

export const NORWIN_TECHNOLOGIES_CATALOG = {
  source: 'norwintechnologies',
  companyName: 'Norwin Technologies',
  officialBrandName: 'Norwin Technologies',
  adapter: 'script',
  modulePath,
  companyCareerPage: 'https://norwintechnologies.com/careers/',
  officialJobsBoardUrl: 'https://norwin.hire.trakstar.com/',
  trakstarJobsHost: 'https://norwin.hire.trakstar.com',
  companyDomain: 'norwintechnologies.com',
  atsPlatform: 'trakstar',
  countryFilter: 'India',
  paginationStrategy: 'single-trakstar-board-root',
  extractionStrategy: 'verified-careers-page+norwin-branded-trakstar-board',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://norwintechnologies.com/careers/ falls into a self-redirect loop on the canonical careers URL, while the Norwin-branded Trakstar board at https://norwin.hire.trakstar.com/ still renders View 1 Opening and exposes Sr, Storage Ops in Atlanta, GA, United States. No India openings were publicly listed on the verified date, so the scraper returns an empty India result after validating the live board.',
}

export default NORWIN_TECHNOLOGIES_CATALOG
