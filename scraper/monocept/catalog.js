import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const MONOCEPT_CATALOG = {
  source: 'monocept',
  companyName: 'Monocept',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.monocept.com/careers',
  companyDomain: 'monocept.com',
  careersUrl: 'https://www.monocept.com/careers',
  handoffUrl: 'https://monocept.turbohire.co/careerpage/0e8227c1-c352-4202-8e40-c0aa16b6ca69',
  officialBrandName: 'Monocept',
  atsPlatform: 'turbohire',
  countryFilter: 'India',
  paginationStrategy: 'native-total-and-unique-identities+all-public-details+closing-snapshots-before-cap',
  extractionStrategy: 'visible-first-party-handoff+reviewed-public-client+full-public-job-dto+matching-jobposting',
  verifiedOn: '2026-10-26',
  verifiedSurfaceSummary: '2026-10-26: Current Careers | Build the Future of Insurance | Monocept delegates to its TurboHire careerpage. The reviewed current native client and normal anonymous All Jobs route expose seven public native roles despite the old careerpage vacancy-free view. Full native descriptions, job-owned India addresses, original CAREERPAGE publication dates, no source expiry, employer and application template identities are reconciled before caps.',
}

export default MONOCEPT_CATALOG
