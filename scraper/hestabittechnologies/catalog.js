import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HESTABIT_TECHNOLOGIES_CATALOG = {
  source: 'hestabittechnologies',
  companyName: 'Hestabit Technologies',
  officialBrandName: 'HestaBit',
  adapter: 'script',
  homepageUrl: 'https://www.hestabit.com/',
  companyCareerPage: 'https://www.hestabit.com/career',
  companyDomain: 'hestabit.com',
  atsPlatform: 'first-party-careers-page-third-party-google-forms-handoff',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-role-teasers+shared-google-forms-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on August 2, 2026 that https://www.hestabit.com/career is the live first-party HestaBit careers page and that it publicly exposes role teasers for Senior PHP Developer, Associate PHP Developer, and Senior Graphic Designer. The visible apply actions currently hand applicants to the shared Google Forms URL at https://docs.google.com/forms/d/e/1FAIpQLSfXioSOGYzPIXMVe9as38gl_tS_ZmQM3ETDoSokRaAwOJOK_w/viewform, so this provider now scrapes the first-party role teasers and preserves the verified third-party apply handoff.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'hestabittechnologies/jobs.json',
}

export default HESTABIT_TECHNOLOGIES_CATALOG
