import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA = {
  source: 'ultravioletteautomotive', companyName: 'Ultraviolette Automotive',
  officialBrandName: 'Ultraviolette Automotive', exactCompanyMatchOnly: true,
  adapter: 'script', modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'), companyDomain: 'ultraviolette.com',
  companyCareerPage: 'https://www.ultraviolette.com/careers',
  officialSiteUrl: 'https://www.ultraviolette.com/', atsPlatform: 'official-zoho-recruit',
  countryFilter: 'India', parser: 'custom-script', normalizationProfile: 'engineering-default',
  paginationStrategy: 'complete-native-embedded-board-array-and-public-api-id-set-parity',
  extractionStrategy: 'official-linked-client-embed-config+native-board-api-parity+all-native-role-details',
  verifiedOn: '2026-10-23', verifiedPublicJobCount: 34, verifiedIndiaJobCount: 34,
  verifiedSurfaceSummary: 'Fresh official /careers page binds its Zoho embed to ultraviolette.zohorecruit.in, page Careers. The complete native embedded board and public API expose the same 34 distinct role IDs; every current native detail names Ultraviolette Automotive Private Limited and explicitly states India. All 34 descriptions were extracted. Date_Opened is retained as an operational field; public publication dates remain null. The old /de/careers route returns 404.',
}
export default PROVIDER_METADATA
