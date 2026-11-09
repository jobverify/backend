import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const IONIDEA_CATALOG = {
  source: 'ionidea',
  companyName: 'IonIdea',
  officialBrandName: 'IonIdea',
  adapter: 'script',
  homepageUrl: 'https://www.ionidea.com/',
  companyCareerPage: 'https://www.ionidea.com/careers.php',
  applyPageUrl: 'https://www.ionidea.com/careers-apply.php',
  companyDomain: 'ionidea.com',
  atsPlatform: 'first-party-inline-jobs-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-inline-jobs-page',
  extractionStrategy: 'verified-first-party-jobs-page+inline-role-sections+shared-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.ionidea.com/careers.php remained the live first-party IonIdea jobs page and publicly exposed inline role sections including APM Consultant/Sr Consultant for Dynatrace, Software Engineer - APM, and Consultant (Devops Engineer), each using the shared first-party apply form at https://www.ionidea.com/careers-apply.php. This local provider reads those first-party inline role sections directly.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'ionidea/jobs.json',
}

export default IONIDEA_CATALOG
