import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MEDIBUDDY_CATALOG = {
  source: 'medibuddy',
  companyName: 'MediBuddy',
  officialBrandName: 'MediBuddy',
  adapter: 'script',
  companyCareerPage: 'https://www.medibuddy.in/health-services/indore-job-openings',
  companyDomain: 'medibuddy.in',
  atsPlatform: 'first-party-framer-jobs-pages+mixed-public-details',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-page-per-program',
  extractionStrategy: 'verified-framer-role-cards+trakstar-details+public-google-doc-role-descriptions',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  firstPartyJobPages: [
    'https://www.medibuddy.in/health-services/indore-job-openings',
    'https://www.medibuddy.in/health-services/medireviva',
  ],
  trakstarJobsHost: 'https://medibuddy.hire.trakstar.com',
  medirevivaApplyUrl: 'https://form.typeform.com/to/lCYKMpLE?typeform-source=www.google.com',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that MediBuddy exposes two current first-party hiring pages at https://www.medibuddy.in/health-services/indore-job-openings and https://www.medibuddy.in/health-services/medireviva. Verified that the Indore page currently links roles such as Associate/ Senior Associate - Operations to the public Trakstar surface at https://medibuddy.hire.trakstar.com, while the MediReViva page exposes docs-backed role descriptions such as Financial Analyst - AR alongside a shared public Typeform application flow.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default MEDIBUDDY_CATALOG
