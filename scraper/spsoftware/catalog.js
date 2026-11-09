import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SP_SOFTWARE_CATALOG = {
  source: 'spsoftware',
  companyName: 'SP Software',
  officialBrandName: 'SPSoft',
  adapter: 'script',
  homepageUrl: 'https://www.spsoftglobal.com/',
  companyCareerPage: 'https://www.spsoftglobal.com/career',
  careersBundleUrl: 'https://www.spsoftglobal.com/app-career-career-module.js',
  atsPlatform: 'first-party-angular-careers-bundle',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-angular-bundle',
  extractionStrategy: 'verified-first-party-careers-route+compiled-angular-careers-bundle',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'spsoftglobal.com',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://www.spsoftglobal.com/career remained the live first-party SPSoft careers route, that the route now returns the company SPA shell with app-root plus runtime.js and main.js, that the legacy company-local Angular bundle at https://www.spsoftglobal.com/app-career-career-module.js still exposes the public jobs contract, and that the verified bundle listed India openings including #001582 Java Developer and #001585 .NET Developer in Hyderabad with the first-party application mailbox careers@spsoftglobal.com.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SP_SOFTWARE_CATALOG
