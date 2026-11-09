import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that https://avanthatechnologies.com/ no longer exposed a trustworthy first-party company site and instead shipped a root javascript redirect using window.location.href="/lander". The redirected exact-name surface at https://avanthatechnologies.com/lander rendered a GoDaddy-style parked lander with window.LANDER_SYSTEM="PW" and img1.wsimg.com parking assets, so there is no trustworthy public careers surface for Avantha Technologies today.'

export const AVANTHA_TECHNOLOGIES_CATALOG = {
  source: 'avanthatechnologies',
  companyName: 'Avantha Technologies',
  officialBrandName: 'Avantha Technologies',
  adapter: 'script',
  homepageUrl: 'https://avanthatechnologies.com/',
  companyCareerPage: 'https://avanthatechnologies.com/',
  officialParkedLanderUrl: 'https://avanthatechnologies.com/lander',
  companyDomain: 'avanthatechnologies.com',
  atsPlatform: 'parked-first-party-domain-no-careers-surface',
  countryFilter: 'India',
  paginationStrategy: 'root-javascript-redirect-plus-parked-lander-validation',
  extractionStrategy:
    'verified-root-javascript-redirect+verified-godaddy-parked-lander+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 0,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'avanthatechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default AVANTHA_TECHNOLOGIES_CATALOG
