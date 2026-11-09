import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AINDRA_SYSTEMS_CATALOG = {
  source: 'aindrasystems',
  companyName: 'Aindra Systems',
  adapter: 'script',
  companyCareerPage: 'https://www.aindra.in/',
  applicationEmail: 'contactus@aindra.in',
  applicationUrl: 'mailto:contactus@aindra.in',
  companyDomain: 'aindra.in',
  atsPlatform: 'official-company-site',
  countryFilter: 'India',
  paginationStrategy: 'single-homepage-careers-section-or-unavailable-first-party-host-fail-closed',
  extractionStrategy: 'verified-homepage-careers-section+inline-role-modals+first-party-host-unavailable-fail-closed',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-28',
  verifiedSurfaceSummary:
    'Verified on July 28, 2026 that the legacy first-party host https://www.aindra.in/ no longer resolves in DNS, while the bare first-party host https://aindra.in/ still resolves but fails TLS verification from this environment. The previously verified Join us at Aindra careers surface is therefore not trustworthily reachable right now, so this provider stays fail-closed until a first-party host becomes safely fetchable again.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AINDRA_SYSTEMS_CATALOG
