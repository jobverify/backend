import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const OTIPY_CATALOG = {
  source: 'otipy',
  companyName: 'Otipy',
  officialBrandName: 'Otipy',
  adapter: 'script',
  homepageUrl: 'https://otipy.com/',
  companyCareerPage: 'https://otipy.com/careers',
  companyDomain: 'otipy.com',
  officialJobsPageUrl: 'https://otipy.com/jobs',
  atsPlatform: 'official-company-site-blocked-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-and-careers-route-blocked-surface-validation',
  extractionStrategy: 'verified-homepage-tls-mismatch+verified-careers-tls-mismatch+verified-jobs-tls-mismatch-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary:
    "Verified on Monday, August 3, 2026 that the official first-party Otipy homepage at https://otipy.com/, the official careers route at https://otipy.com/careers, and the official jobs route at https://otipy.com/jobs all failed with the same first-party TLS contract error: ERR_TLS_CERT_ALTNAME_INVALID because Host: otipy.com is not in the certificate's altnames and only DNS:gps.vendors.intusystems.info is presented, so no trustworthy public jobs surface was exposed.",
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'otipy/jobs.json',
}

export default OTIPY_CATALOG
