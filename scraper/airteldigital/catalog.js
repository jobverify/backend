import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AIRTEL_DIGITAL_CATALOG = {
  source: 'airteldigital',
  companyName: 'Airtel Digital',
  officialBrandName: 'Airtel',
  adapter: 'script',
  companyCareerPage: 'https://careers.airtel.com/',
  companyDomain: 'careers.airtel.com',
  sharedDarwinboxUrl: 'https://airtel.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  sharedCareersApiUrl: 'https://careersapi.airtel.com/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-shell-plus-shared-bundle-and-darwinbox-shell-checks',
  extractionStrategy:
    'verified-first-party-careers-shell+bundle-config+shared-darwinbox-shell-with-no-distinct-airtel-digital-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified https://careers.airtel.com/, https://careers.airtel.com/static/js/main.57023176.js, and https://airtel.darwinbox.in/ms/candidatev2/main/careers/allJobs on July 15, 2026. Airtel Careers is a live first-party shell that points to the shared Airtel Darwinbox board and references the first-party careers API root at https://careersapi.airtel.com/, but the verified public surface exposed no distinct Airtel Digital public jobs surface, label, or route.',
  dryRunFile: 'airteldigital/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default AIRTEL_DIGITAL_CATALOG
