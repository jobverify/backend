import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const SAP_ARIBA_CATALOG = {
  source: 'sapariba',
  companyName: 'SAP Ariba',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.sap.com/about/careers.html',
  companyDomain: 'sap.com',
  careersUrl: 'https://www.sap.com/about/careers.html',
  officialBrandName: 'SAP Ariba',
  parentBrandName: 'SAP',
  atsPlatform: 'generic-parent-brand-careers-only',
  countryFilter: 'India',
  paginationStrategy: 'fail-closed',
  extractionStrategy: 'exact-name-absence-on-generic-sap-careers',
  verifiedOn: '2026-07-18',
  lastCheckedOn: '2026-10-08',
  sourceListingComplete: false,
  currentVerificationDisposition: 'upstream-public-access-blocked',
  currentSurfaceObservation: 'October 8, 2026: official SAP careers redirects to jobs.sap.com, whose current homepage, search and new job details return HTTP403 Cloudflare challenges. Accessible legacy careers.sap.com Ariba keyword results are an incomplete alternate inventory and cannot establish global or India zero.',
  verifiedSurfaceSummary: 'Saturday, July 18, 2026: SAP exposed only the generic SAP careers search surface and public SAP job detail pages. No trustworthy exact-name SAP Ariba public careers or jobs surface was available, so this provider stays fail-closed.',
}

export default SAP_ARIBA_CATALOG
